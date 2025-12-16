/**
 * Enhanced test script for leave delete button functionality
 * This script helps debug and fix the delete button issue
 */

function testLeaveDeleteFunctionality() {
    console.log('🔧 Testing Leave Delete Functionality');
    console.log('=====================================');
    
    // Check if we're on the correct page
    const currentPath = window.location.pathname;
    console.log(`📍 Current path: ${currentPath}`);
    
    if (!currentPath.includes('leaves')) {
        console.log('❌ Not on leave management page. Navigate to /leaves first.');
        return;
    }
    
    // Check for React components and state
    console.log('\n🔍 Checking React Components:');
    
    // Look for leave request cards
    const leaveCards = document.querySelectorAll('[id^="leave-request-"]');
    console.log(`📋 Found ${leaveCards.length} leave request cards`);
    
    // Look for delete buttons specifically
    const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const hasTrashIcon = btn.querySelector('[data-lucide="trash-2"]') || 
                           btn.innerHTML.includes('Trash2') ||
                           btn.textContent.includes('Delete');
        const hasRedGradient = btn.className.includes('rose-500') || 
                              btn.className.includes('red-500');
        return hasTrashIcon && hasRedGradient;
    });
    
    console.log(`🗑️ Found ${deleteButtons.length} delete buttons`);
    
    // Test each delete button
    deleteButtons.forEach((button, index) => {
        console.log(`\n🔍 Delete Button ${index + 1}:`);
        console.log(`   - Text: "${button.textContent.trim()}"`);
        console.log(`   - Disabled: ${button.disabled}`);
        console.log(`   - Visible: ${button.offsetParent !== null}`);
        
        // Check parent context (should be pending leave)
        const parentCard = button.closest('[id^="leave-request-"]');
        if (parentCard) {
            const statusBadge = parentCard.querySelector('.capitalize');
            const status = statusBadge ? statusBadge.textContent.trim().toLowerCase() : 'unknown';
            console.log(`   - Leave status: ${status}`);
            console.log(`   - Should be deletable: ${status === 'pending' ? '✅' : '❌'}`);
        }
        
        // Add enhanced click handler for testing
        const originalHandler = button.onclick;
        button.onclick = function(e) {
            console.log(`🖱️ Delete button ${index + 1} clicked!`);
            console.log('   - Event:', e);
            console.log('   - Button element:', this);
            
            // Call original handler if it exists
            if (originalHandler) {
                console.log('   - Calling original handler...');
                return originalHandler.call(this, e);
            } else {
                console.log('   - No original handler found, checking React events...');
                
                // Try to trigger React event
                const reactEvents = Object.keys(this).filter(key => key.startsWith('__reactEventHandlers'));
                if (reactEvents.length > 0) {
                    console.log('   - React event handlers found:', reactEvents);
                } else {
                    console.log('   - No React event handlers found');
                }
            }
        };
    });
    
    // Check for delete confirmation dialog
    console.log('\n🔍 Checking Delete Dialog:');
    const deleteDialog = document.querySelector('[role="alertdialog"]');
    const dialogTitle = document.querySelector('[role="alertdialog"] h2');
    
    console.log(`   - Dialog present: ${deleteDialog ? '✅' : '❌'}`);
    console.log(`   - Dialog visible: ${deleteDialog && deleteDialog.offsetParent !== null ? '✅' : '❌'}`);
    
    if (dialogTitle) {
        console.log(`   - Dialog title: "${dialogTitle.textContent}"`);
        const isDeleteDialog = dialogTitle.textContent.includes('Delete Leave');
        console.log(`   - Is delete dialog: ${isDeleteDialog ? '✅' : '❌'}`);
    }
    
    // Check API service
    console.log('\n🔍 Checking API Service:');
    if (window.apiService) {
        console.log('   - API service available: ✅');
        if (window.apiService.deleteLeaveRequest) {
            console.log('   - deleteLeaveRequest method: ✅');
        } else {
            console.log('   - deleteLeaveRequest method: ❌');
        }
    } else {
        console.log('   - API service available: ❌');
    }
    
    // Check for any JavaScript errors
    console.log('\n🔍 Checking for Errors:');
    const originalError = console.error;
    let errorCount = 0;
    console.error = function(...args) {
        errorCount++;
        console.log(`   - Error ${errorCount}:`, ...args);
        originalError.apply(console, args);
    };
    
    // Simulate a delete button click if available
    if (deleteButtons.length > 0) {
        console.log('\n🧪 Testing Delete Button Click:');
        const testButton = deleteButtons[0];
        console.log('   - Simulating click on first delete button...');
        
        try {
            testButton.click();
            
            // Check if dialog appeared after click
            setTimeout(() => {
                const dialogAfterClick = document.querySelector('[role="alertdialog"]');
                const dialogVisible = dialogAfterClick && dialogAfterClick.offsetParent !== null;
                console.log(`   - Dialog appeared after click: ${dialogVisible ? '✅' : '❌'}`);
                
                if (!dialogVisible) {
                    console.log('   - ⚠️ Delete dialog did not appear. Possible issues:');
                    console.log('     1. Button click handler not properly attached');
                    console.log('     2. React state not updating correctly');
                    console.log('     3. Dialog component not rendering');
                    console.log('     4. CSS hiding the dialog');
                }
            }, 100);
            
        } catch (error) {
            console.log(`   - Error clicking button: ${error.message}`);
        }
    }
    
    console.log('\n📝 Troubleshooting Steps:');
    console.log('1. Ensure you have pending leave requests');
    console.log('2. Check browser console for JavaScript errors');
    console.log('3. Verify React DevTools shows proper state updates');
    console.log('4. Test with different browsers');
    console.log('5. Clear browser cache and reload');
    
    return {
        leaveCards: leaveCards.length,
        deleteButtons: deleteButtons.length,
        deleteDialog: !!deleteDialog,
        apiService: !!(window.apiService && window.apiService.deleteLeaveRequest)
    };
}

// Auto-run when script loads
if (typeof window !== 'undefined') {
    window.testLeaveDeleteFunctionality = testLeaveDeleteFunctionality;
    console.log('💡 Run testLeaveDeleteFunctionality() to test the delete functionality');
    
    // Auto-run if on leaves page
    if (window.location.pathname.includes('leaves')) {
        setTimeout(testLeaveDeleteFunctionality, 2000);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testLeaveDeleteFunctionality };
}