const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'public');
const targetFile = 'C:\\Users\\Baman Jaynilkumar\\Downloads\\smart_city_ilp_capital_budgeting_optimizer.html';

const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(baseDir, 'app.js'), 'utf8');

// Replace external css link with inlined style
let standalone = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');

// Replace external js link with inlined script
standalone = standalone.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>');

fs.writeFileSync(targetFile, standalone, 'utf8');
console.log('Successfully wrote standalone file to Downloads. Length:', standalone.length);
