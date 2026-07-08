const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const dirty = '<div>\n\n\n\n</div>';
const clean = DOMPurify.sanitize(dirty);
console.log('Clean:', JSON.stringify(clean));
