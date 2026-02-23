import { promises as fs } from 'fs';
import path from 'path';

const srcDir = path.resolve('src/i18n/translations');
const destDir = path.resolve('public/i18n');

async function syncI18n() {
  try {
    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });
    // Read all files in source directory
    const files = await fs.readdir(srcDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);
        await fs.copyFile(srcFile, destFile);
        console.log(`Copied ${srcFile} -> ${destFile}`);
      }
    }
    console.log('i18n sync complete.');
  } catch (err) {
    console.error('Error syncing i18n files:', err);
    process.exit(1);
  }
}

syncI18n();
