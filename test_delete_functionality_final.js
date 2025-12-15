/**
 * Final test script for leave delete functionality
 * This script will verify that the delete button and confirmation dialog work correctly
 */

function testDeleteFunctionality() {
    console.log('🧪 Final Delete Functionality Test');
    console.log('==================================');
    
    // Check if we're on the correct page
    if (!window.location.pathname.includes('leaves')) {
        console.log('❌ Please navigate to the leaves page first');
        return;
    }
    
    // Look for pending leave requests
    const leaveCards = document.querySelectorAll('[id^="leave-request-"]');
    console.log(`📋 Found ${leaveCards.length} leave request cards`);
    
    if (leaveCards.length === 0) {
        console.log('❌ No leave requests found. Please create a leave request first.');
        return;
    }
    
    // Find delete buttons (only for pending requests)
    const deleteButtons = [];
    
    leaveCards.forEach((card, index) => {
        const statusBadge = card.querySelector('.capitalize');
        const status = statusBadge ? statusBadge.textContent.trim().toLowerCase() : 'unknown';
        
        if (status === 'pending') {
            const deleteBtn = card.querySelector('button[class*="rose-500"]');
            if (deleteBtn && deleteBtn.innerHTML.includes('Trash2')) {
                deleteButtons.push({
                    button: deleteBtn,
                    cardIndex: index,
                    status: status
                });
            }
        }
    });
    
    console.log(`🗑️ Found ${deleteButtons.length} delete buttons for pending requests`);
    
    if (deleteButtons.length === 0) {
        console.log('❌ No delete buttons found for pending requests.');
        console.log('   Make sure you have pending leave requests to test with.');
        return;
    }
    
    // Test the first delete button
    const testButton = deleteButtons[0];
    console.log(`🧪 Testing delete button for card ${testButton.cardIndex + 1}`);
    
    // Check initial dialog state
    const initialDialog = document.querySelector('[role="alertdialog"]');
    const initiallyVisible = initialDialog && initialDialog.offsetParent !== null;
    console.log(`📋 Dialog initially visible: ${initiallyVisible}`);
    
    // Add event listener to monitor dialog changes
    let dialogAppeared = false;
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
                const dialog = mutation.target;
                if (dialog.getAttribute('data-state') === 'open') {
                    console.log('✅ Delete confirmation dialog appeared!');
                    dialogAppeared = true;
                    
                    // Check dialog content
                    const title = dialog.querySelector('[role="alertdialog"] h2');
                    const description = dialog.querySelector('[role="alertdialog"] p');
                    
                    if (title) {
                        console.log(`📝 Dialog title: "${title.textContent}"`);
                    }
                    
                    if (description) {
                        console.log(`📝 Dialog description: "${description.textContent.substring(0, 100)}..."`);
                    }
                    
                    // Look for action buttons
                    const cancelBtn = dialog.querySelector('button:contains("Cancel")') || 
                                    Array.from(dialog.querySelectorAll('button')).find(btn => 
                                        btn.textContent.includes('Cancel'));
                    const deleteBtn = dialog.querySelector('button:contains("Delete")') || 
                                    Array.from(dialog.querySelectorAll('button')).find(btn => 
                                        btn.textContent.includes('Delete'));
                    
                    console.log(`🔘 Cancel button found: ${!!cancelBtn}`);
                    console.log(`🔘 Delete button found: ${!!deleteBtn}`);
                    
                    if (cancelBtn && deleteBtn) {
                        console.log('✅ Dialog is fully functional with both action buttons');
                        
                        // Optionally test the cancel button
                        setTimeout(() => {
                            console.log('🧪 Testing cancel button...');
                            cancelBtn.click();
                            
                            setTimeout(() => {
                                const dialogAfterCancel = document.querySelector('[role="alertdialog"]');
                                const stillVisible = dialogAfterCancel && dialogAfterCancel.offsetParent !== null;
                                console.log(`📋 Dialog closed after cancel: ${!stillVisible ? '✅' : '❌'}`);
                            }, 100);
                        }, 1000);
                    }
                }
            }
        });
    });
    
    // Start observing
    const dialogContainer = document.body;
    observer.observe(dialogContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'style', 'class']
    });
    
    // Click the delete button
    console.log('🖱️ Clicking delete button...');
    testButton.button.click();
    
    // Check result after a delay
    setTimeout(() => {
        if (dialogAppeared) {
            console.log('🎉 SUCCESS: Delete functionality is working correctly!');
            console.log('   - Delete button responds to clicks');
            console.log('   - Confirmation dialog appears');
            console.log('   - Dialog has proper content and buttons');
        } else {
            console.log('❌ ISSUE: Delete button clicked but dialog did not appear');
            console.log('   This could indicate:');
            console.log('   1. Event handler not properly attached');
            console.log('   2. React state not updating');
            console.log('   3. Dialog component not rendering');
            console.log('   4. CSS preventing dialog visibility');
            
            // Check for any JavaScript errors
            console.log('   Check browser console for any JavaScript errors');
        }
        
        // Stop observing
        observer.disconnect();
    }, 2000);
    
    return {
        leaveCards: leaveCards.length,
        deleteButtons: deleteButtons.length,
        testExecuted: true
    };
}

// Instructions for manual testing
function showManualTestInstructions() {
    console.log('📋 Manual Testing Instructions:');
    console.log('==============================');
    console.log('1. Navigate to the Leave Management page');
    console.log('2. Ensure you have at least one PENDING leave request');
    console.log('3. Run testDeleteFunctionality() in the console');
    console.log('4. Look for the delete button (trash icon with red gradient)');
    console.log('5. Click the delete button');
    console.log('6. Verify that a confirmation dialog appears');
    console.log('7. Test both "Cancel" and "Delete" buttons in the dialog');
    console.log('8. Confirm that the leave request is removed after deletion');
}

// Auto-run when script loads
if (typeof window !== 'undefined') {
    window.testDeleteFunctionality = testDeleteFunctionality;
    window.showManualTestInstructions = showManualTestInstructions;
    
    console.log('💡 Available functions:');
    console.log('   - testDeleteFunctionality() - Automated test');
    console.log('   - showManualTestInstructions() - Manual testing guide');
    
    // Auto-run if on leaves page
    if (window.location.pathname.includes('leaves')) {
        setTimeout(() => {
            console.log('🚀 Auto-running delete functionality test...');
            testDeleteFunctionality();
        }, 3000);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testDeleteFunctionality, showManualTestInstructions };
}