import fs from 'fs';
import path from 'path';

const searchDir = 'C:/Users/manik/Desktop/HMS-main/HMS-main';
const pattern = '9999999999';

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(pattern)) {
          console.log(`Found in: ${fullPath}`);
        }
      } catch (e) {}
    }
  }
}

search(searchDir);
console.log('Search complete.');
