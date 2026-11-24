import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeArticleContent } from './articleContent';

test('article content preserves allowed formatting and lead class', () => {
  const sanitized = sanitizeArticleContent('<p class="lead">Intro <strong>aman</strong></p><h2>Judul</h2><ul><li>Tips</li></ul>');

  assert.equal(sanitized, '<p class="lead">Intro <strong>aman</strong></p><h2>Judul</h2><ul><li>Tips</li></ul>');
});

test('article content strips executable tags, attributes, and unsupported embeds', () => {
  const sanitized = sanitizeArticleContent('<p onclick="alert(1)">Aman</p><script>alert(2)</script><iframe src="javascript:alert(3)"></iframe>');

  assert.equal(sanitized, '<p>Aman</p>');
});
