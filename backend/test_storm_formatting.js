const NotionTextFormatter = require('./src/notionTextFormatter');

async function testStormFormatting() {
    console.log('🌪️ Testing Improved STORM Formatting...\n');
    
    const formatter = new NotionTextFormatter();
    
    // Test the deep heading conversion
    console.log('📑 Test 1: Deep Heading Conversion');
    const complexOutline = `# Introduction
## Definition and Motivation
### Advantages over Full Fine-Tuning
#### Reduced Computational Cost
#### Reduced Memory Requirements
#### Increased Accessibility
### Applications
# Methods
## Low-Rank Adaptation (LoRA)
### Mathematical Principles
#### Low-Rank Matrix Decomposition
#### Relationship to Regularization Techniques
##### Intrinsic Dimensionality
###### Very Deep Heading
### Variants
#### QLoRA
#### OLoRA`;

    console.log('Original outline (first few lines):');
    console.log(complexOutline.split('\n').slice(0, 10).join('\n'));
    
    const improvedOutline = formatter.convertDeepHeadingsToHierarchy(complexOutline);
    console.log('\nImproved outline (first few lines):');
    console.log(improvedOutline.split('\n').slice(0, 15).join('\n'));
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test complete STORM formatting
    console.log('📝 Test 2: Complete STORM Formatting');
    const mockStormResult = {
        topic: 'Parameter Efficient Fine-Tuning',
        overview: 'This research explores parameter-efficient fine-tuning methods for large language models.',
        outline: complexOutline,
        article: `# Parameter Efficient Fine-Tuning

Parameter efficient fine-tuning (PEFT) has emerged as a crucial technique for adapting large language models.

## Introduction
### Background
#### Historical Context
##### Early Approaches
###### Traditional Methods

PEFT methods allow for efficient adaptation with minimal computational overhead.

### Key Benefits
- Reduced memory requirements
- Lower computational costs
- Better accessibility`,
        sources: [
            'https://arxiv.org/abs/2106.09685',
            { title: 'LoRA Paper', url: 'https://arxiv.org/abs/2106.09685' },
            'url_to_invalid_source',
            { title: 'Invalid Source', url: 'invalid-url' }
        ],
        metadata: {
            depth: 'Comprehensive',
            sourceCount: 12
        }
    };
    
    try {
        const blocks = await formatter.formatStormContentForNotion(mockStormResult, 'parameter efficient fine-tuning');
        const validatedBlocks = formatter.validateNotionBlocks(blocks);
        
        console.log(`✅ Generated ${blocks.length} blocks, ${validatedBlocks.length} validated`);
        
        // Show the structure of generated blocks
        console.log('\n📊 Block structure:');
        const blockTypes = blocks.reduce((acc, block) => {
            acc[block.type] = (acc[block.type] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(blockTypes).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} blocks`);
        });
        
        // Find and display sources section
        console.log('\n📚 Sources section preview:');
        const sourcesBlocks = blocks.filter(block => 
            block.paragraph && 
            block.paragraph.rich_text.some(rt => rt.text.content.match(/^\d+\./))
        );
        
        sourcesBlocks.slice(0, 3).forEach((block, index) => {
            const text = block.paragraph.rich_text.map(rt => rt.text.content).join('');
            console.log(`  ${index + 1}: ${text}`);
        });
        
        // Find generation details section
        console.log('\n📋 Generation details preview:');
        const detailsBlocks = blocks.filter(block => 
            block.paragraph && 
            block.paragraph.rich_text.some(rt => rt.text.content.includes('Generated on:'))
        );
        
        if (detailsBlocks.length > 0) {
            const text = detailsBlocks[0].paragraph.rich_text.map(rt => rt.text.content).join('');
            console.log(`  ${text}`);
        }
        
    } catch (error) {
        console.error('❌ Error in complete STORM formatting test:', error.message);
    }
    
    console.log('\n🎉 STORM formatting test completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    testStormFormatting().catch(console.error);
}

module.exports = { testStormFormatting }; 