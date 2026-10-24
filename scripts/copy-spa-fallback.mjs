import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
copyFileSync(path.join(outputDirectory, 'index.html'), path.join(outputDirectory, '404.html'));
