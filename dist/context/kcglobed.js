"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlBlogs = crawlBlogs;
exports.debugBlogStructure = debugBlogStructure;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
async function crawlBlogs() {
    const response = await axios_1.default.get("https://kcglobed.com/blog");
    const $ = cheerio.load(response.data);
    const blogs = [];
    // First, let's try multiple selectors to find blog containers
    const possibleSelectors = [
        'article',
        '.post',
        '.blog-post',
        '.entry',
        '.post-item',
        '[class*="post"]',
        '[class*="blog"]',
        '.content-item',
        '.news-item'
    ];
    let blogElements = null;
    // Find the first selector that returns elements
    for (const selector of possibleSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
            blogElements = elements;
            console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
            break;
        }
    }
    // If no blog containers found, try to find elements with links that might be blog posts
    if (!blogElements || blogElements.length === 0) {
        console.log('⚠️ No blog containers found, searching for potential blog links...');
        blogElements = $('div').filter((_, el) => {
            return $(el).find('a[href*="blog"], a[href*="post"]').length > 0;
        });
    }
    if (!blogElements || blogElements.length === 0) {
        console.log('❌ No blog elements found');
        return blogs;
    }
    blogElements.each((_, el) => {
        const $el = $(el);
        // Try multiple strategies to find title
        let title = '';
        const titleSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.title', '.post-title', '.entry-title', '.blog-title',
            '[class*="title"]', '[class*="heading"]',
            'span', 'strong', 'b'
        ];
        for (const selector of titleSelectors) {
            const titleText = $el.find(selector).first().text().trim();
            if (titleText && titleText.length > 5) { // Ensure it's not just a short meaningless text
                title = titleText;
                break;
            }
        }
        // If still no title, try getting text from the first link
        if (!title) {
            const linkText = $el.find('a').first().text().trim();
            if (linkText && linkText.length > 5) {
                title = linkText;
            }
        }
        // Try multiple strategies to find URL
        let url = '';
        const linkSelectors = [
            'h1 a', 'h2 a', 'h3 a', 'h4 a', 'h5 a', 'h6 a',
            '.title a', '.post-title a', '.entry-title a',
            'a[href*="blog"]', 'a[href*="post"]',
            'a'
        ];
        for (const selector of linkSelectors) {
            const href = $el.find(selector).first().attr('href');
            if (href) {
                url = href;
                break;
            }
        }
        // Try multiple strategies to find snippet
        let snippet = '';
        const snippetSelectors = [
            '.entry-summary', '.post-excerpt', '.excerpt', '.description',
            '.summary', '.content', '.post-content',
            '[class*="excerpt"]', '[class*="summary"]',
            'p'
        ];
        for (const selector of snippetSelectors) {
            const snippetText = $el.find(selector).first().text().trim();
            if (snippetText && snippetText.length > 10) {
                snippet = snippetText.substring(0, 200); // Limit snippet length
                break;
            }
        }
        // Clean and validate data
        if (title && url) {
            // Clean title
            title = title.replace(/\s+/g, ' ').trim();
            // Ensure URL is absolute
            if (!url.startsWith('http')) {
                url = url.startsWith('/') ? `https://kcglobed.com${url}` : `https://kcglobed.com/${url}`;
            }
            // Clean snippet
            snippet = snippet.replace(/\s+/g, ' ').trim();
            blogs.push({
                title,
                url,
                snippet,
            });
        }
    });
    console.log(`✅ Crawled ${blogs.length} blogs`);
    // If we got very few results, log some debug info
    if (blogs.length < 3) {
        console.log('⚠️ Low blog count, debugging...');
        console.log('Available elements on page:');
        $('article, div[class*="post"], div[class*="blog"]').each((i, el) => {
            if (i < 5) { // Only log first 5 for brevity
                console.log(`Element ${i}:`, $(el).attr('class'), $(el).find('a').first().attr('href'));
            }
        });
    }
    return blogs;
}
// Alternative function that logs the page structure for debugging
async function debugBlogStructure() {
    try {
        const response = await axios_1.default.get("https://kcglobed.com/blog");
        const $ = cheerio.load(response.data);
        console.log('=== DEBUG: Page Structure Analysis ===');
        // Log all elements that might contain blog posts
        const potentialContainers = $('article, div[class*="post"], div[class*="blog"], div[class*="entry"], .content');
        console.log(`Found ${potentialContainers.length} potential blog containers`);
        potentialContainers.slice(0, 3).each((i, el) => {
            const $el = $(el);
            console.log(`\nContainer ${i + 1}:`);
            console.log('Classes:', $el.attr('class'));
            console.log('Headings found:', $el.find('h1, h2, h3, h4, h5, h6').map((_, h) => $(h).text().trim()).get());
            console.log('Links found:', $el.find('a').map((_, a) => $(a).attr('href')).get().slice(0, 3));
            console.log('Text content (first 100 chars):', $el.text().trim().substring(0, 100));
        });
        // Log all unique class names that might be relevant
        const classNames = new Set();
        $('*[class]').each((_, el) => {
            const classes = $(el).attr('class')?.split(/\s+/) || [];
            classes.forEach(cls => {
                if (cls.includes('post') || cls.includes('blog') || cls.includes('entry') || cls.includes('article')) {
                    classNames.add(cls);
                }
            });
        });
        console.log('\nRelevant classes found:', Array.from(classNames));
    }
    catch (error) {
        console.error('Error debugging blog structure:', error);
    }
}
//# sourceMappingURL=kcglobed.js.map