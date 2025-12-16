/**
 * Test script for online/offline timer functionality
 * This script helps verify that the timing calculations are working correctly
 */

function testOnlineOfflineTimers() {
    console.log('🧪 Testing Online/Offline Timer Functionality');
    console.log('=============================================');
    
    // Check if we're on the attendance page
    const currentPath = window.location.pathname;
    console.log(`📍 Current path: ${currentPath}`);
    
    if (!currentPath.includes('attendance')) {
        console.log('❌ Not on attendance page. Navigate to /attendance first.');
        return { success: false, reason: 'Wrong page' };
    }
    
    // Look for timer elements
    console.log('\n🔍 Checking Timer Elements:');
    
    // Find online time display
    const onlineTimeElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Online Time:') || text.includes('ONLINE TIME');
    });
    
    console.log(`📊 Found ${onlineTimeElements.length} online time elements`);
    
    // Find offline time display
    const offlineTimeElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Total Offline:') || text.includes('OFFLINE TIME');
    });
    
    console.log(`📊 Found ${offlineTimeElements.length} offline time elements`);
    
    // Find status toggle button
    const statusToggleButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent || '';
        return text.includes('Go Online') || text.includes('Go Offline');
    });
    
    console.log(`🔘 Found ${statusToggleButtons.length} status toggle buttons`);
    
    // Check current status
    const statusBadges = Array.from(document.querySelectorAll('.bg-green-500, .bg-slate-500')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Online') || text.includes('Offline');
    });
    
    let currentStatus = 'Unknown';
    if (statusBadges.length > 0) {
        currentStatus = statusBadges[0].textContent?.includes('Online') ? 'Online' : 'Offline';
    }
    
    console.log(`📡 Current status: ${currentStatus}`);
    
    // Extract current timer values
    let onlineTime = 'Not found';
    let offlineTime = 'Not found';
    
    if (onlineTimeElements.length > 0) {
        const onlineElement = onlineTimeElements[0];
        const match = onlineElement.textContent?.match(/(\d+\s*hrs?\s*-\s*\d+\s*mins?)/);
        if (match) {
            onlineTime = match[1];
        }
    }
    
    if (offlineTimeElements.length > 0) {
        const offlineElement = offlineTimeElements[0];
        const match = offlineElement.textContent?.match(/(\d+\s*hrs?\s*-\s*\d+\s*mins?)/);
        if (match) {
            offlineTime = match[1];
        }
    }
    
    console.log(`⏱️ Current Online Time: ${onlineTime}`);
    console.log(`⏱️ Current Offline Time: ${offlineTime}`);
    
    // Check if times are the same (this was the bug)
    if (onlineTime !== 'Not found' && offlineTime !== 'Not found') {
        const timesAreSame = onlineTime === offlineTime;
        console.log(`🔍 Times are ${timesAreSame ? 'SAME (❌ BUG)' : 'DIFFERENT (✅ CORRECT)'}`);
        
        if (timesAreSame && onlineTime !== '0 hrs - 0 mins') {
            console.log('🚨 BUG DETECTED: Online and Offline times should be different!');
            console.log('   This indicates the timer calculation is incorrect.');
        } else {
            console.log('✅ Timer values look correct');
        }
    }
    
    // Test status toggle if available
    if (statusToggleButtons.length > 0) {
        console.log('\n🧪 Testing Status Toggle:');
        const toggleButton = statusToggleButtons[0];
        const buttonText = toggleButton.textContent || '';
        
        console.log(`🔘 Found toggle button: "${buttonText}"`);
        console.log('📝 Instructions for manual testing:');
        console.log('1. Note the current online and offline times');
        console.log('2. Click the status toggle button');
        console.log('3. Wait for the status to change');
        console.log('4. Observe that:');
        console.log('   - Online time continues from where it left off when going back online');
        console.log('   - Offline time increases only during paused periods');
        console.log('   - Both times should show different values (not the same)');
        
        // Add click event listener for testing
        const originalHandler = toggleButton.onclick;
        toggleButton.addEventListener('click', function testClickHandler(e) {
            console.log('🖱️ Status toggle clicked!');
            console.log('⏱️ Pre-click times:', { online: onlineTime, offline: offlineTime });
            
            // Remove this test handler after first click
            toggleButton.removeEventListener('click', testClickHandler);
            
            // Monitor for changes
            setTimeout(() => {
                console.log('🔍 Checking for timer updates after status change...');
                testOnlineOfflineTimers(); // Re-run test to see changes
            }, 2000);
        }, { once: true });
    }
    
    // Monitor for timer updates
    console.log('\n📊 Monitoring Timer Updates:');
    let updateCount = 0;
    const maxUpdates = 10;
    
    const monitorInterval = setInterval(() => {
        updateCount++;
        
        // Re-extract current values
        let newOnlineTime = 'Not found';
        let newOfflineTime = 'Not found';
        
        const currentOnlineElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return text.includes('Online Time:') || text.includes('ONLINE TIME');
        });
        
        const currentOfflineElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return text.includes('Total Offline:') || text.includes('OFFLINE TIME');
        });
        
        if (currentOnlineElements.length > 0) {
            const match = currentOnlineElements[0].textContent?.match(/(\d+\s*hrs?\s*-\s*\d+\s*mins?)/);
            if (match) newOnlineTime = match[1];
        }
        
        if (currentOfflineElements.length > 0) {
            const match = currentOfflineElements[0].textContent?.match(/(\d+\s*hrs?\s*-\s*\d+\s*mins?)/);
            if (match) newOfflineTime = match[1];
        }
        
        // Check for changes
        if (newOnlineTime !== onlineTime || newOfflineTime !== offlineTime) {
            console.log(`📈 Timer Update ${updateCount}: Online=${newOnlineTime}, Offline=${newOfflineTime}`);
            
            // Check if they're still the same (bug indicator)
            if (newOnlineTime === newOfflineTime && newOnlineTime !== '0 hrs - 0 mins') {
                console.log('⚠️ WARNING: Times are still the same - bug may persist');
            } else {
                console.log('✅ Times are different - fix appears to be working');
            }
            
            onlineTime = newOnlineTime;
            offlineTime = newOfflineTime;
        }
        
        if (updateCount >= maxUpdates) {
            clearInterval(monitorInterval);
            console.log('📊 Monitoring complete');
        }
    }, 1000);
    
    // Stop monitoring after 30 seconds
    setTimeout(() => {
        clearInterval(monitorInterval);
        console.log('⏰ Monitoring timeout reached');
    }, 30000);
    
    return {
        success: true,
        currentStatus,
        onlineTime,
        offlineTime,
        timesAreSame: onlineTime === offlineTime,
        hasToggleButton: statusToggleButtons.length > 0
    };
}

function showTimerTestInstructions() {
    console.log('📋 Timer Testing Instructions:');
    console.log('=============================');
    console.log('1. Navigate to the Attendance page');
    console.log('2. Ensure you are checked in (have an active attendance record)');
    console.log('3. Run testOnlineOfflineTimers() in the console');
    console.log('4. Observe the current online and offline times');
    console.log('5. Click the "Go Offline" button and provide a reason');
    console.log('6. Wait and observe that:');
    console.log('   - Online time stops increasing');
    console.log('   - Offline time starts increasing');
    console.log('   - Both show different values');
    console.log('7. Click "Go Online" to resume');
    console.log('8. Verify that:');
    console.log('   - Online time continues from where it left off');
    console.log('   - Offline time stops increasing');
    console.log('   - Values remain separate and accurate');
}

// Auto-run when script loads
if (typeof window !== 'undefined') {
    window.testOnlineOfflineTimers = testOnlineOfflineTimers;
    window.showTimerTestInstructions = showTimerTestInstructions;
    
    console.log('💡 Available functions:');
    console.log('   - testOnlineOfflineTimers() - Test timer functionality');
    console.log('   - showTimerTestInstructions() - Show testing guide');
    
    // Auto-run if on attendance page
    if (window.location.pathname.includes('attendance')) {
        setTimeout(() => {
            console.log('🚀 Auto-running timer test...');
            testOnlineOfflineTimers();
        }, 3000);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testOnlineOfflineTimers, showTimerTestInstructions };
}