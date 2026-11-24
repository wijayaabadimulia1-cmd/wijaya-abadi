import { Transform } from 'node:stream';

export function createMp4ValidationStream(maxBytes: number, onBytesReceived: (size: number) => void): Transform {
  let totalBytes = 0;
  let header = Buffer.alloc(0);

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;
      onBytesReceived(totalBytes);
      if (totalBytes > maxBytes) {
        callback(new Error(`Video melebihi batas ukuran ${Math.floor(maxBytes / (1024 * 1024))} MB.`));
        return;
      }
      if (header.length < 12) header = Buffer.concat([header, chunk.subarray(0, 12 - header.length)]);
      callback(null, chunk);
    },
    flush(callback) {
      if (totalBytes === 0) callback(new Error('File video kosong.'));
      else if (header.length < 12 || header.toString('ascii', 4, 8).toLowerCase() !== 'ftyp') callback(new Error('Konten file bukan video MP4 yang valid.'));
      else callback();
    },
  });
}
