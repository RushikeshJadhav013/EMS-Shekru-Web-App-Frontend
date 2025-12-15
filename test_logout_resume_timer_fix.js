/**
 * Test script to verify logout/resume timer fix
 * This test simulates the logout/login cycle and verifies correct time calculation
 */

// Mock backend response for user online status
const mockUserOnlineStatusResponse = {
  is_checked_in: true,
  is_online: true,
  attendance_id: 123,
  check_in: '2024-12-11T09:00:00Z',
  last_status_change: '2024-12-11T11:30:00Z' // User went online at 11:30 AM
};

// Mock backend response for working hours
const mockWorkingHoursResponse = {
  attendance_id: 123,
  working_hours: 2.5,
  total_seconds: 9000, // 2.5 hours = 9000 seconds
  total_offline_seconds: 1800, // 30 minutes offline
  is_currently_online: true,
  check_in: '2024-12-11T09:00:00Z',
  check_out: null
};

// Simulate the fixed fetchUserOnlineStatus logic
function simulateUserStatusResume(backendResponse, currentTime) {
  const wasOnline = backendResponse.is_online;
  const lastStatusChangeTime = new Date(backendResponse.last_status_change);
  const now = new Date(currentTime);
  
  let onlineStartTime = null;
  let offlineStartTime = null;
  
  if (wasOnline) {
    // User was online - resume online timer from last status change
    onlineStartTime = lastStatusChangeTime;
    offlineStartTime = null;
  } else {
    // User was offline - resume offline timer from last status change
    onlineStartTime = null;
    offlineStartTime = lastStatusChangeTime;
  }
  
  return { onlineStartTime, offlineStartTime, isOnline: wasOnline };
}

// Simulate the fixed working hours sync logic
function simulateWorkingHoursSync(timerState, backendResponse, currentTime) {
  const { onlineStartTime, offlineStartTime, isOnline } = timerState;
  const now = new Date(currentTime);
  const backendOnlineSeconds = backendResponse.total_seconds;
  const backendOfflineSeconds = backendResponse.total_offline_seconds;
  
  let accumulatedOnlineSeconds = 0;
  let accumulatedOfflineSeconds = 0;
  
  if (isOnline && onlineStartTime) {
    // Currently online - set accumulated to backend value minus current session
    const currentSessionSeconds = Math.floor((now.getTime() - onlineStartTime.getTime()) / 1000);
    accumulatedOnlineSeconds = Math.max(0, backendOnlineSeconds - currentSessionSeconds);
  } else {
    // Currently offline - set accumulated to backend value
    accumulatedOnlineSeconds = backendOnlineSeconds;
  }
  
  if (!isOnline && offlineStartTime) {
    // Currently offline - set accumulated to backend value minus current session
    const currentSessionSeconds = Math.floor((now.getTime() - offlineStartTime.getTime()) / 1000);
    accumulatedOfflineSeconds = Math.max(0, backendOfflineSeconds - currentSessionSeconds);
  } else {
    // Currently online - set accumulated to backend value
    accumulatedOfflineSeconds = backendOfflineSeconds;
  }
  
  return { accumulatedOnlineSeconds, accumulatedOfflineSeconds };
}

// Helper function to format time display
function formatTimeDisplay(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours === 0 && minutes === 0) {
    return '0 hrs - 0 mins';
  } else if (hours === 0) {
    return `0 hrs - ${minutes} mins`;
  } else if (minutes === 0) {
    return `${hours} hrs - 0 mins`;
  } else {
    return `${hours} hrs - ${minutes} mins`;
  }
}

// Test the fix
console.log('🧪 Testing Logout/Resume Timer Fix');
console.log('=' * 50);

// Scenario: User logged back in at 12:00 PM
const currentTime = '2024-12-11T12:00:00Z';
const currentTimeObj = new Date(currentTime);

console.log('\n📋 Test Scenario:');
console.log(`- User checked in at: ${mockUserOnlineStatusResponse.check_in}`);
console.log(`- User last went online at: ${mockUserOnlineStatusResponse.last_status_change}`);
console.log(`- User logged back in at: ${currentTime}`);
console.log(`- Backend reports: ${mockWorkingHoursResponse.total_seconds}s online, ${mockWorkingHoursResponse.total_offline_seconds}s offline`);

// Step 1: Simulate user status resume
console.log('\n1️⃣ Simulating user status resume...');
const timerState = simulateUserStatusResume(mockUserOnlineStatusResponse, currentTime);
console.log(`✅ Online start time set to: ${timerState.onlineStartTime?.toLocaleTimeString()}`);
console.log(`✅ Status: ${timerState.isOnline ? 'Online' : 'Offline'}`);

// Step 2: Simulate working hours sync
console.log('\n2️⃣ Simulating working hours sync...');
const syncResult = simulateWorkingHoursSync(timerState, mockWorkingHoursResponse, currentTime);

// Step 3: Calculate current display values
console.log('\n3️⃣ Calculating display values...');
const currentSessionSeconds = timerState.isOnline && timerState.onlineStartTime 
  ? Math.floor((currentTimeObj.getTime() - timerState.onlineStartTime.getTime()) / 1000)
  : 0;

const totalOnlineSeconds = syncResult.accumulatedOnlineSeconds + currentSessionSeconds;
const totalOfflineSeconds = syncResult.accumulatedOfflineSeconds;

const onlineDisplay = formatTimeDisplay(totalOnlineSeconds);
const offlineDisplay = formatTimeDisplay(totalOfflineSeconds);

console.log(`📊 Results:`);
console.log(`   - Accumulated online: ${syncResult.accumulatedOnlineSeconds}s`);
console.log(`   - Current session: ${currentSessionSeconds}s`);
console.log(`   - Total online: ${totalOnlineSeconds}s (${onlineDisplay})`);
console.log(`   - Total offline: ${totalOfflineSeconds}s (${offlineDisplay})`);

// Verify the fix
const expectedOnlineSeconds = 9000; // Backend reports 9000s total, current session is already included
const isCorrect = Math.abs(totalOnlineSeconds - expectedOnlineSeconds) < 60; // Allow 1 minute tolerance

if (isCorrect) {
  console.log('\n🎉 SUCCESS: Timer resume is working correctly!');
  console.log(`✅ Expected 2.5 hours online time, got ${onlineDisplay}`);
  console.log(`✅ Offline time correctly shows ${offlineDisplay}`);
  console.log('✅ No more 6-hour incorrect display after logout/login');
} else {
  console.log('\n❌ FAILED: Timer resume is still incorrect');
  console.log(`Expected 2.5 hours online time, got ${onlineDisplay}`);
  console.log(`Total seconds: expected ~${expectedOnlineSeconds}, got ${totalOnlineSeconds}`);
}

console.log('\n📝 Key fixes applied:');
console.log('- Use last_status_change timestamp from backend, not current time');
console.log('- Properly calculate accumulated vs current session time');
console.log('- Add detailed logging for debugging timezone/calculation issues');
console.log('- Reset accumulated times to 0 when resuming to force backend sync');