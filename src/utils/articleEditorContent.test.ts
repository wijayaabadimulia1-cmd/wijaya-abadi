import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArticleContent, serializeArticleContent } from './articleEditorContent';

test('article editor converts simple fields to safe formatted HTML', () => {
  const content = serializeArticleContent('Intro <aman>', [
    { id: 'one', heading: 'Langkah pertama', body: 'Paragraf satu.\n\n- Helm\n- Jaket' },
  ]);

  assert.equal(content, '<p class="lead">Intro &lt;aman&gt;</p><h2>Langkah pertama</h2><p>Paragraf satu.</p><ul><li>Helm</li><li>Jaket</li></ul>');
});

test('article editor loads existing headings, paragraphs, and lists into fields', () => {
  const parsed = parseArticleContent('<p class="lead">Pembuka &amp; ringkasan.</p><h2>Persiapan</h2><p>Periksa kendaraan.</p><ul><li>Ban</li><li>Rem</li></ul>');

  assert.equal(parsed.intro, 'Pembuka & ringkasan.');
  assert.deepEqual(parsed.sections, [
    { id: 'section-1', heading: 'Persiapan', body: 'Periksa kendaraan.\n\n- Ban\n- Rem' },
  ]);
});

test('article editor keeps legacy plain-text article content editable', () => {
  const parsed = parseArticleContent('Artikel lama tanpa format HTML.');

  assert.equal(parsed.intro, 'Artikel lama tanpa format HTML.');
  assert.deepEqual(parsed.sections, [{ id: 'section-1', heading: '', body: '' }]);
});
