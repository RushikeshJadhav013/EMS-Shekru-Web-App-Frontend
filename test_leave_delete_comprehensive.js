/**
 * Comprehensive test for leave delete functionality
 * This script will help identify exactly what's wrong with the delete button
 */

function comprehensiveDeleteTest() {
    console.log('🔧 Comprehensive Leave Delete Test');
    console.log('==================================');
    
    // Step 1: Check if we're on the correct page
    const currentPath = window.location.pathname;
    console.log(`📍 Current path: ${currentPath}`);
    
    if (!currentPath.includes('leaves')) {
        console.log('❌ Not on leave management page. Navigate to /leaves first.');
        return { success: false, reason: 'Wrong page' };
    }
    
    // Step 2: Check for React components
    console.log('\n🔍 Checking React Components:');
    
    // Look for leave request cards
    const leaveCards = document.querySelectorAll('[id^="leave-request-"]');
    console.log(`📋 Found ${leaveCards.length} leave request cards`);
    
    if (leaveCards.length === 0) {
        console.log('❌ No leave request cards found. Make sure you have some leave requests.');
        return { success: false, reason: 'No leave cards' };
    }
    
    // Step 3: Find delete buttons
    const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const hasTrashIcon = btn.querySelector('[data-lucide="trash-2"]') || 
                           btn.innerHTML.includes('Trash2') ||
                           btn.textContent.includes('Delete');
        const hasRedGradient = btn.className.includes('rose-500') || 
                              btn.className.includes('red-500');
        return hasTrashIcon && hasRedGradient;
    });
    
    console.log(`🗑️ Found ${deleteButtons.length} delete buttons`);
    
    if (deleteButtons.length === 0) {
        console.log('❌ No delete buttons found. This could mean:');
        console.log('   1. No pending leave requests (only pending can be deleted)');
        console.log('   2. Delete buttons are not rendering properly');
        console.log('   3. CSS classes have changed');
        
        // Check for any buttons with trash icons
        const anyTrashButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            return btn.querySelector('[data-lucide="trash-2"]') || 
                   btn.innerHTML.includes('Trash2');
        });
        console.log(`   Found ${anyTrashButtons.length} buttons with trash icons (any color)`);
        
        return { success: false, reason: 'No delete buttons' };
    }
    
    // Step 4: Test each delete button
    let testResults = [];
    
    deleteButtons.forEach((button, index) => {
        console.log(`\n🔍 Testing Delete Button ${index + 1}:`);
        
        // Check button properties
        const isDisabled = button.disabled;
        const isVisible = button.offsetParent !== null;
        const hasClickHandler = !!button.onclick;
        
        console.log(`   - Disabled: ${isDisabled}`);
        console.log(`   - Visible: ${isVisible}`);
        console.log(`   - Has onClick: ${hasClickHandler}`);
        
        // Check parent context
        const parentCard = button.closest('[id^="leave-request-"]');
        let leaveStatus = 'unknown';
        
        if (parentCard) {
            const statusBadge = parentCard.querySelector('.capitalize');
            leaveStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : 'unknown';
            console.log(`   - Leave status: ${leaveStatus}`);
        }
        
        // Only test if button should be functional
        const shouldWork = !isDisabled && isVisible && leaveStatus === 'pending';
        console.log(`   - Should work: ${shouldWork ? '✅' : '❌'}`);
        
        if (shouldWork) {
            // Test the click functionality
            console.log(`   - Testing click...`);
            
            // Store original state
            const originalDialogState = document.querySelector('[role="alertdialog"]');
            const wasDialogVisible = originalDialogState && originalDialogState.offsetParent !== null;
            
            try {
                // Click the button
                button.click();
                
                // Check if dialog appeared
                setTimeout(() => {
                    const dialogAfterClick = document.querySelector('[role="alertdialog"]');
                    const isDialogVisible = dialogAfterClick && dialogAfterClick.offsetParent !== null;
                    
                    const result = {
                        buttonIndex: index + 1,
                        clicked: true,
                        dialogAppeared: isDialogVisible && !wasDialogVisible,
                        leaveStatus: leaveStatus
                    };
                    
                    console.log(`   - Dialog appeared: ${result.dialogAppeared ? '✅' : '❌'}`);
                    testResults.push(result);
                    
                    // If this is the last button, show summary
                    if (index === deleteButtons.length - 1) {
                        showTestSummary(testResults);
                    }
                }, 100);
                
            } catch (error) {
                console.log(`   - Error clicking: ${error.message}`);
                testResults.push({
                    buttonIndex: index + 1,
                    clicked: false,
                    error: error.message,
                    leaveStatus: leaveStatus
                });
            }
        } else {
            testResults.push({
                buttonIndex: index + 1,
                clicked: false,
                reason: `Button not functional (disabled: ${isDisabled}, visible: ${isVisible}, status: ${leaveStatus})`,
                leaveStatus: leaveStatus
            });
        }
    });
    
    // Step 5: Check API service
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
    
    // Step 6: Check for JavaScript errors
    console.log('\n🔍 Monitoring for JavaScript Errors:');
    const originalError = console.error;
    let errorCount = 0;
    
    console.error = function(...args) {
        errorCount++;
        console.log(`   - JS Error ${errorCount}:`, ...args);
        originalError.apply(console, args);
    };
    
    return {
        success: true,
        leaveCards: leaveCards.length,
        deleteButtons: deleteButtons.length,
        testResults: testResults
    };
}

function showTestSummary(results) {
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    const successful = results.filter(r => r.dialogAppeared).length;
    const failed = results.filter(r => r.clicked && !r.dialogAppeared).length;
    const notTested = results.filter(r => !r.clicked).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Not tested: ${notTested}`);
    
    if (failed > 0) {
        console.log('\n🔧 Troubleshooting for failed tests:');
        console.log('1. Check browser console for React errors');
        console.log('2. Verify React state is updating correctly');
        console.log('3. Check if event handlers are properly attached');
        console.log('4. Ensure dialog component is not being blocked by CSS');
        console.log('5. Try refreshing the page and testing again');
    }
    
    if (successful === 0 && failed > 0) {
        console.log('\n🚨 ISSUE IDENTIFIED: Delete buttons are clicking but dialog is not appearing');
        console.log('This suggests a problem with:');
        console.log('- React state management (isDeleteDialogOpen not updating)');
        console.log('- Event handler not calling handleDeleteLeave correctly');
        console.log('- Dialog component not rendering when state changes');
    }
}

// Auto-run when script loads
if (typeof window !== 'undefined') {
    window.comprehensiveDeleteTest = comprehensiveDeleteTest;
    console.log('💡 Run comprehensiveDeleteTest() to test the delete functionality');
    
    // Auto-run if on leaves page
    if (window.location.pathname.includes('leaves')) {
        setTimeout(comprehensiveDeleteTest, 2000);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { comprehensiveDeleteTest };
}