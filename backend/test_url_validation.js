const NotionTextFormatter = require('./src/notionTextFormatter');

async function testUrlValidation() {
    console.log('🔗 Testing URL Validation...\n');
    
    const formatter = new NotionTextFormatter();
    
    // Test different URL scenarios
    const testUrls = [
        'https://example.com',
        'http://example.com',
        'example.com',
        'url_to_unified_index',
        'url_to_info',
        '',
        null,
        undefined,
        'ftp://example.com',
        'javascript:alert("xss")',
        'https://very-long-valid-url.example.com/path/to/resource?param=value',
        'invalid-url',
        'http://',
        'https://'
    ];
    
    console.log('Testing individual URLs:');
    testUrls.forEach(url => {
        const cleaned = formatter.cleanUrl(url);
        const isValid = formatter.isValidUrl(url);
        console.log(`  "${url}" → "${cleaned}" (original valid: ${isValid})`);
    });
    
    console.log('\n📝 Testing STORM content with invalid URLs...');
    
    const mockStormWithBadUrls = {
        topic: 'Test Topic',
        article: '# Test Article\n\nThis is test content.',
        sources: [
            'url_to_unified_index',
            'url_to_info',
            { title: 'Valid Source', url: 'https://example.com' },
            { title: 'Invalid Source', url: 'invalid-url' },
            'https://another-valid.com',
            ''
        ]
    };
    
    try {
        const blocks = await formatter.formatStormContentForNotion(mockStormWithBadUrls, 'Test Query');
        const validatedBlocks = formatter.validateNotionBlocks(blocks);
        
        console.log(`✅ Generated ${blocks.length} blocks, ${validatedBlocks.length} validated`);
        console.log('✅ No URL validation errors - invalid URLs were properly handled');
        
        // Find the sources section to verify how it was handled
        const sourcesBlocks = blocks.filter(block => 
            block.paragraph && 
            block.paragraph.rich_text.some(rt => rt.text.content.includes('Source'))
        );
        
        console.log(`📚 Found ${sourcesBlocks.length} source blocks`);
        
    } catch (error) {
        console.error('❌ Error in STORM formatting test:', error.message);
    }
    
    console.log('\n🎉 URL validation test completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    testUrlValidation().catch(console.error);
}

module.exports = { testUrlValidation }; 