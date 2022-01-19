import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(request, response) {
    const { email } = request.body;
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    const users = dbClient.database.collection('users');
    const dupEmail = await users.findOne({ email });
    if (dupEmail) {
      response.status(400).json({ error: 'Already exist' });
      return;
    }

    const { password } = request.body;
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }
    const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(password);
    const hashPass = sha1Hash.digest('hex');

    const result = await users.insertOne({ email, password: hashPass });
    response.status(201).json({ id: result.insertedId, email });
  }
}

export default UsersController;
