import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { requestRepository } from '../repositories/request.repository.js';
import { attachmentRepository } from '../repositories/attachment.repository.js';
import { ownerScope } from '../models/request.model.js';
import { ensure, required } from '../errors/HttpError.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Tipos aceptados, reconocidos por su firma (bytes iniciales), no por la extensión del nombre.
const FILE_TYPES = [
  {
    mime: 'application/pdf',
    extension: '.pdf',
    matches: (b) => b.subarray(0, 5).toString() === '%PDF-',
  },
  {
    mime: 'image/jpeg',
    extension: '.jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  { mime: 'image/png', extension: '.png', matches: (b) => b.subarray(0, 8).equals(PNG_SIGNATURE) },
  {
    mime: 'image/webp',
    extension: '.webp',
    matches: (b) =>
      b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
];

const detectFile = (buffer) =>
  required(
    FILE_TYPES.find((type) => type.matches(buffer)),
    400,
    'Solo se aceptan archivos PDF, JPG, PNG o WebP válidos.',
  );

async function assertCanAttach(requestId) {
  const request = required(
    await requestRepository.find(requestId),
    404,
    'Solicitud no encontrada.',
  );
  ensure(
    request.status === 'Realizada',
    409,
    'Registra la aplicación antes de adjuntar remisiones.',
  );
}

// Escribe el archivo y lo registra; si el registro falla, borra el archivo.
async function storeFile(file, type, requestId, actor) {
  const id = randomUUID();
  const storedName = `${id}${type.extension}`;
  const filePath = path.join(config.uploadDir, storedName);
  await mkdir(config.uploadDir, { recursive: true });
  await writeFile(filePath, file.buffer, { flag: 'wx' });
  const record = {
    id,
    requestId,
    storedName,
    originalName: path.basename(file.originalname).slice(0, 255),
    mime: type.mime,
    size: file.size,
  };
  await attachmentRepository.create(record, actor).catch(async (error) => {
    await unlink(filePath).catch(() => {});
    throw error;
  });
  return { id };
}

export const attachmentService = {
  async upload(requestId, file, user) {
    ensure(file, 400, 'Selecciona una foto o PDF.');
    const type = detectFile(file.buffer);
    await assertCanAttach(requestId);
    return storeFile(file, type, requestId, user.name);
  },
  async download(id, user) {
    const file = required(
      await attachmentRepository.find(id, ownerScope(user)),
      404,
      'Archivo no encontrado.',
    );
    return { path: path.join(config.uploadDir, file.stored_name), name: file.original_name };
  },
};
