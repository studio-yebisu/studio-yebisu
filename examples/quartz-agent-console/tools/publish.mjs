import {copyFile, cp} from 'node:fs/promises';

// The preview output is separate from the editable source and vendored files.
await cp('.local/build/assets', 'assets', {recursive: true});
await copyFile('.local/build/source.html', 'index.html');
