// Removes the previous build output (hashed files would pile up otherwise). Only static/assets and static/index.html are build products.
const fs = require('fs'), path = require('path');
fs.rmSync(path.join(__dirname, '..', 'static', 'assets'), { recursive: true, force: true });
