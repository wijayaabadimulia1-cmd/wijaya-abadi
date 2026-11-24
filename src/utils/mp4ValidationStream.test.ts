import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createMp4ValidationStream } from './mp4ValidationStream';

function mp4Header(size = 16) {
  const buffer = Buffer.alloc(size);
  buffer.writeUInt32BE(size, 0);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write('isom', 8, 'ascii');
  return buffer;
}

function discardStream() {
  return new Writable({ write(_chunk, _encoding, callback) { callback(); } });
}

test('MP4 stream validation accepts chunked files and tracks bytes without buffering the full file', async () => {
  let receivedBytes = 0;
  const file = mp4Header(32);
  await pipeline(
    Readable.from([file.subarray(0, 7), file.subarray(7)]),
    createMp4ValidationStream(1024, (size) => { receivedBytes = size; }),
    discardStream(),
  );
  assert.equal(receivedBytes, file.length);
});

test('MP4 stream validation rejects non-MP4 and empty files', async () => {
  await assert.rejects(
    pipeline(Readable.from([Buffer.from('not an mp4 file')]), createMp4ValidationStream(1024, () => {}), discardStream()),
    /bukan video MP4/,
  );
  await assert.rejects(
    pipeline(Readable.from([]), createMp4ValidationStream(1024, () => {}), discardStream()),
    /kosong/,
  );
});

test('MP4 stream validation enforces the upload byte limit', async () => {
  await assert.rejects(
    pipeline(Readable.from([mp4Header(32)]), createMp4ValidationStream(16, () => {}), discardStream()),
    /batas ukuran/,
  );
});
