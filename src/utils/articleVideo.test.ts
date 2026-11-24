import assert from 'node:assert/strict';
import test from 'node:test';
import { getYouTubeEmbedUrl, getYouTubeVideoId, isHttpUrl } from './articleVideo';

test('YouTube watch, short, shorts, and embed URLs resolve to official embed ids', () => {
  const videoId = 'aQSbvARMAoc';
  for (const url of [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://youtube.com/shorts/${videoId}`,
    `https://m.youtube.com/embed/${videoId}`,
  ]) {
    assert.equal(getYouTubeVideoId(url), videoId);
    assert.equal(getYouTubeEmbedUrl(url), `https://www.youtube-nocookie.com/embed/${videoId}`);
  }
});

test('YouTube URL validation rejects unrelated hosts, invalid protocols, and malformed ids', () => {
  assert.equal(getYouTubeVideoId('https://youtube.example/watch?v=aQSbvARMAoc'), null);
  assert.equal(getYouTubeVideoId('javascript://youtube.com/watch?v=aQSbvARMAoc'), null);
  assert.equal(getYouTubeVideoId('https://youtube.com/watch?v=short'), null);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('/relative/path'), false);
});
