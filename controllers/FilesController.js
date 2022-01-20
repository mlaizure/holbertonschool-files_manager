import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, type, data } = request.body;
    let { parentId, isPublic } = request.body;
    isPublic = !!isPublic;
    parentId = parentId || 0;
    const files = dbClient.database.collection('files');
    if (!name) {
      response.status(400).json({ error: 'Missing name' });
    } else if (!['file', 'image', 'folder'].includes(type)) {
      response.status(400).json({ error: 'Missing type' });
    } else if (!data && type !== 'folder') {
      response.status(400).json({ error: 'Missing data' });
    } else {
      if (parentId !== 0) {
        const parentFile = await files.findOne({ _id: ObjectID(parentId) });
        if (!parentFile) {
          response.status(400).json({ error: 'Parent not found' });
        } else if (parentFile.type !== 'folder') {
          response.status(400).json({ error: 'Parent is not a folder' });
          return;
        }
      }

      if (!fs.existsSync(FOLDER_PATH)) fs.mkdirSync(FOLDER_PATH);
      if (type === 'folder') {
        const { insertedId } = await files.insertOne({
          name, type, parentId, isPublic, userId: ObjectID(userId),
        });
        response.status(201).json({
          name, type, parentId, isPublic, userId, id: insertedId,
        });
      } else {
        const token = uuidv4();
        const buff = Buffer.from(data, 'base64');
        const localPath = `${FOLDER_PATH}/${token}`;
        fs.writeFileSync(localPath, buff, { encoding: 'binary' });
        const { insertedId } = await files.insertOne({
          name, type, parentId, isPublic, userId: ObjectID(userId), localPath,
        });
        response.status(201).json({
          name, type, parentId, isPublic, userId, id: insertedId,
        });
      }
    }
  }

  static async getShow(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const files = dbClient.database.collection('files');
    const fileInfo = await files.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(request.params.id),
    });
    if (!fileInfo) {
      response.status(404).json({ error: 'Not found' });
      return;
    }
    const {
      name, type, parentId, isPublic, _id,
    } = fileInfo;
    response.status(200).json({
      name, type, parentId, isPublic, userId, id: _id,
    });
  }

  static async getIndex(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let { parentId } = request.query;
    parentId = parentId ? ObjectID(parentId) : 0;
    let { page } = request.query;
    if (!page) page = 0;
    const files = dbClient.database.collection('files');
    const PAGE_SIZE = 20;
    const resultsArray = await files.aggregate([
      { $match: { parentId, userId: ObjectID(userId) } },
      { $skip: page * PAGE_SIZE },
      { $limit: page * PAGE_SIZE + PAGE_SIZE },
    ]).toArray();
    response.status(200).json(resultsArray);
  }
}

export default FilesController;
