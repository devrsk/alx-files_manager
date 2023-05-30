import { ObjectId } from 'mongodb';
import uuid4 from 'uuid';
import { mkdir, writeFile } from 'fs';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(rq, rs) {
    const usrId = rq.headers('X-Token') || null;
    if (!usrId) return rs.status(401).send({ error: 'Unauthorized' });
    const usr = dbClient.users.findOne({ _id: ObjectId(usrId) });
    if (!usr) return rs.status(401).send({ error: 'Unauthorized' });

    const fname = rq.body.name;
    if (!fname) return rs.status(400).send({ error: 'Missing name' });
    const ftype = rq.body.type;
    const acceptType = ['folder', 'file', 'image'];
    if (!ftype || (!acceptType.includes(ftype))) {
      return rs.status(400).send({ error: 'Missing type' });
    }
    const fdata = rq.body.data;
    if (!fdata && ftype !== 'folder') {
      rs.status(400).send({ error: 'Missing data' });
    }
    let fparentId = rq.body.parentId;
    if (fparentId) {
      const Parent = await dbClient.files.findOne({ _id: ObjectId(fparentId) });
      if (!Parent) return rs.status(400).send({ error: 'Parent not found' });
      if (Parent !== 'folder') {
        return rs.status(400).send({ error: 'Parent is not a folder' });
      }
    } else {
      fparentId = 0;
    }
    const fisPublic = rq.body.isPublic || false;

    const finsert = {
      userId: usr._id,
      name: fname,
      type: ftype,
      parentId: fparentId,
      isPublic: fisPublic,
    };
    if (ftype === 'folder') {
      await dbClient.files.insertOne(finsert);
      const rtrnd = {
        id: finsert._id,
        userId: finsert.userId,
        name: finsert.name,
        type: finsert.type,
        isPublic: finsert.isPublic,
        parentId: finsert.parentId,
      };
      rs.status(201).send(rtrnd);
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const lfname = uuid4();
    const path = `${folderPath}/${lfname}`;
    const lfdata = Buffer.from(fdata, 'base-64');

    mkdir(folderPath, { recursive: true }, (err) => {
      if (err) return rs.status(400).send(err.message);
      return true;
    });

    writeFile(path, lfdata, (err) => {
      if (err) return rs.status(400).send(err.message);
      return true;
    });
    finsert.localpath = path;
    await dbClient.files.insertOne(finsert);
    const rtrnd2 = {
      id: finsert._id,
      userId: finsert.userId,
      name: finsert.name,
      type: finsert.type,
      isPublic: finsert.isPublic,
      parentId: finsert.parentId,
    };
    return rs.status(201).send(rtrnd2);
  }
}

export default FilesController;
