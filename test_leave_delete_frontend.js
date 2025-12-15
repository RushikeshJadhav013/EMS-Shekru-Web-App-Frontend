/**
 * Frontend test for leave deletion functionality
 * This script tests the delete button behavior in the browser
 */

// Test function to simulate delete button click
function testDeleteButton() {
    console.log('🧪 Testing Leave Delete Button Functionality');
    
    // Check if we're on the leave management page
    const currentPath = window.location.pathname;
    if (!currentPath.includes('leaves')) {
        console.log('❌ Not on leave management page. Navigate to /leaves first.');
        return;
    }
    
    // Look for delete buttons
    const deleteButtons = document.querySelectorAll('button[class*="rose-500"]');
    console.log(`📋 Found ${deleteButtons.length} potential delete buttons`);
    
    // Look for leave request cards
    const leaveCards = document.querySelectorAll('[id^="leave-request-"]');
    console.log(`📋 Found ${leaveCards.length} leave request cards`);
    
    // Check if delete buttons are properly attached
    deleteButtons.forEach((button, index) => {
        const hasTrashIcon = button.querySelector('svg') || button.innerHTML.includes('Trash');
        const hasDeleteText = button.textContent.includes('Delete');
        
        console.log(`🔍 Button ${index + 1}:`);
        console.log(`   - Has trash icon: ${hasTrashIcon ? '✅' : '❌'}`);
        console.log(`   - Has delete text: ${hasDeleteText ? '✅' : '❌'}`);
        console.log(`   - Is disabled: ${button.disabled ? '⚠️ Yes' : '✅ No'}`);
        console.log(`   - Has click handler: ${button.onclick ? '✅ Yes' : '❓ Unknown'}`);
    });
    
    // Check for delete dialog
    const deleteDialog = document.querySelector('[role="alertdialog"]');
    console.log(`🔍 Delete dialog present: ${deleteDialog ? '✅ Yes' : '❌ No'}`);
    
    // Test API service
    if (window.apiService && window.apiService.deleteLeaveRequest) {
        console.log('✅ API service deleteLeaveRequest method is available');
    } else {
        console.log('❌ API service deleteLeaveRequest method is missing');
    }
    
    console.log('\n📝 Test Summary:');
    console.log('1. Navigate to leave management page');
    console.log('2. Apply for a test leave request');
    console.log('3. Look for the delete button (trash icon) next to pending requests');
    console.log('4. Click the delete button');
    console.log('5. Confirm deletion in the dialog');
    console.log('6. Verify the request is removed from both sender and receiver dashboards');
    
    return {
        deleteButtonsFound: deleteButtons.length,
        leaveCardsFound: leaveCards.length,
        deleteDialogPresent: !!deleteDialog,
        apiServiceAvailable: !!(window.apiService && window.apiService.deleteLeaveRequest)
    };
}

// Auto-run test when script loads
if (typeof window !== 'undefined') {
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', testDeleteButton);
    } else {
        testDeleteButton();
    }
    
    // Make test function available globally
    window.testLeaveDelete = testDeleteButton;
    
    console.log('💡 Run window.testLeaveDelete() to test the delete functionality');
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testDeleteButton };
}