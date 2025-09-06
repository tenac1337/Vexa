/**
 * Test script for Enhanced Email Generation
 * This can be run in the browser console to test the email generation
 */

// Test the EmailContentGenerator class
async function testEnhancedEmailGeneration() {
    console.log('🧪 Testing Enhanced Email Generation with Gemini 1.5 Pro...\n');
    
    // Import the email services (this would be available in the browser context)
    const { sendEnhancedEmail } = await import('./emailServices.js');
    
    const testCases = [
        {
            name: "Professional Business Email",
            context: {
                to: "test@example.com",
                purpose: "Follow up on our meeting about the new project proposal",
                tone: "professional",
                content: "Discussed budget, timeline, and team requirements",
                additionalContext: "Meeting was on Tuesday, we agreed to move forward"
            }
        },
        {
            name: "Friendly Introduction Email",
            context: {
                to: "colleague@company.com",
                purpose: "Introduce myself as the new team member",
                tone: "friendly",
                content: "Just joined the marketing team, background in digital campaigns",
                additionalContext: "Starting next Monday, excited to collaborate"
            }
        },
        {
            name: "Formal Request Email",
            context: {
                to: "manager@company.com",
                purpose: "Request approval for conference attendance",
                tone: "formal",
                content: "AI Summit 2024, relevant to our current projects, professional development",
                additionalContext: "Conference dates are March 15-17, budget needed is $2000"
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📧 Testing: ${testCase.name}`);
        console.log('Context:', testCase.context);
        
        try {
            // Note: This test simulates the email generation without actually sending
            // In real usage, it would attempt to send via Gmail API
            const result = await sendEnhancedEmail(testCase.context.to, {
                subject: testCase.context.subject,
                purpose: testCase.context.purpose,
                tone: testCase.context.tone,
                content: testCase.context.content,
                additionalContext: testCase.context.additionalContext
            });
            
            if (result.success) {
                console.log('✅ Email generation successful!');
                console.log('Generated subject:', result.subject || 'AI Generated');
                console.log('Content preview:', result.body ? result.body.substring(0, 200) + '...' : 'Generated content');
            } else {
                console.log('❌ Email generation failed:', result.error);
            }
        } catch (error) {
            console.log('❌ Test failed:', error.message);
        }
    }
    
    console.log('\n🎉 Enhanced email testing complete!');
}

// Export for browser console testing
if (typeof window !== 'undefined') {
    window.testEnhancedEmailGeneration = testEnhancedEmailGeneration;
    console.log('📧 Enhanced Email Test loaded! Run testEnhancedEmailGeneration() to test.');
}

export { testEnhancedEmailGeneration }; 