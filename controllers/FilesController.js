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
    } else if (parentId && parentId !== 0) {
      const parentFile = await files.findOne({ _id: ObjectID(parentId) });
      if (!parentFile) {
        response.status(400).json({ error: 'Parent not found' });
      } else if (parentFile.type !== 'folder') {
        response.status(400).json({ error: 'Parent is not a folder' });
      } else {
        if (!fs.existsSync(FOLDER_PATH)) fs.mkdirSync(FOLDER_PATH);
        if (type === 'folder') {
          const { insertedId } = await files.insertOne({
            name, type, parentId, isPublic, userId,
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
            name, type, parentId, isPublic, userId, localPath,
          });
          response.status(201).json({
            name, type, parentId, isPublic, userId, id: insertedId,
          });
        }
      }
    }
  }
}

export default FilesController;
