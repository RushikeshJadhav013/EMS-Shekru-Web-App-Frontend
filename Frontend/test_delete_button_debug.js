/**
 * Debug script for leave delete button functionality
 * Run this in the browser console on the leave management page
 */

function debugDeleteButton() {
    console.log('🔍 Debugging Leave Delete Button Functionality');
    console.log('==========================================');
    
    // Check if we're on the correct page
    const currentPath = window.location.pathname;
    console.log(`📍 Current path: ${currentPath}`);
    
    if (!currentPath.includes('leaves')) {
        console.log('❌ Not on leave management page. Navigate to /leaves first.');
        return;
    }
    
    // Look for leave request cards
    const leaveCards = document.querySelectorAll('[id^="leave-request-"]');
    console.log(`📋 Found ${leaveCards.length} leave request cards`);
    
    // Look for delete buttons
    const deleteButtons = document.querySelectorAll('button');
    const trashButtons = Array.from(deleteButtons).filter(btn => {
        const hasTrashIcon = btn.querySelector('svg[data-lucide="trash-2"]') || 
                           btn.innerHTML.includes('Trash2') ||
                           btn.textContent.includes('Delete');
        const hasRedGradient = btn.className.includes('rose-500') || 
                              btn.className.includes('red-500');
        return hasTrashIcon || hasRedGradient;
    });
    
    console.log(`🗑️ Found ${trashButtons.length} potential delete buttons`);
    
    trashButtons.forEach((button, index) => {
        console.log(`\n🔍 Delete Button ${index + 1}:`);
        console.log(`   - Text: "${button.textContent.trim()}"`);
        console.log(`   - Classes: ${button.className}`);
        console.log(`   - Disabled: ${button.disabled}`);
        console.log(`   - Has onClick: ${!!button.onclick}`);
        console.log(`   - Parent element:`, button.parentElement);
        
        // Check if button is clickable
        const rect = button.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        console.log(`   - Visible: ${isVisible}`);
        console.log(`   - Position: ${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`);
        
        // Add test click handler
        button.addEventListener('click', function(e) {
            console.log(`🖱️ Delete button ${index + 1} clicked!`, e);
        }, { once: true });
    });
    
    // Check for delete dialog
    const deleteDialog = document.querySelector('[role="alertdialog"]');
    console.log(`\n🔍 Delete Dialog:`);
    console.log(`   - Present: ${!!deleteDialog}`);
    if (deleteDialog) {
        console.log(`   - Visible: ${deleteDialog.style.display !== 'none'}`);
        console.log(`   - Classes: ${deleteDialog.className}`);
    }
    
    // Check React state (if accessible)
    try {
        const reactRoot = document.querySelector('#root');
        if (reactRoot && reactRoot._reactInternalFiber) {
            console.log('⚛️ React detected');
        }
    } catch (e) {
        console.log('⚛️ React state not accessible');
    }
    
    // Check API service
    if (window.apiService) {
        console.log('✅ API service available');
        if (window.apiService.deleteLeaveRequest) {
            console.log('✅ deleteLeaveRequest method available');
        } else {
            console.log('❌ deleteLeaveRequest method missing');
        }
    } else {
        console.log('❌ API service not available');
    }
    
    console.log('\n📝 Instructions:');
    console.log('1. Look for pending leave requests in your history');
    console.log('2. Click on a delete button (trash icon)');
    console.log('3. Check console for click events');
    console.log('4. Verify if confirmation dialog appears');
    
    return {
        leaveCards: leaveCards.length,
        deleteButtons: trashButtons.length,
        deleteDialog: !!deleteDialog
    };
}

// Auto-run when script loads
if (typeof window !== 'undefined') {
    window.debugDeleteButton = debugDeleteButton;
    console.log('💡 Run debugDeleteButton() to test the delete functionality');
    
    // Auto-run if on leaves page
    if (window.location.pathname.includes('leaves')) {
        setTimeout(debugDeleteButton, 1000);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debugDeleteButton };
}