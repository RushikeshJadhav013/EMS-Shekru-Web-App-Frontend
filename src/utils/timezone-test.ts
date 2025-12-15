/**
 * Timezone Testing Utilities
 * 
 * Use these functions to test and verify timezone conversions
 * Run in browser console: import('./utils/timezone-test').then(m => m.runTimezoneTests())
 */

import {
  toIST,
  formatIST,
  formatDateTimeIST,
  formatTimeIST,
  formatDateIST,
  formatDistanceToNowIST,
  nowIST,
  todayIST,
  parseToIST,
  formatBackendDateIST,
  formatDateTimeComponentsIST,
  APP_TIMEZONE,
} from './timezone';

/**
 * Run comprehensive timezone tests
 */
export function runTimezoneTests() {
  console.group('🕐 Timezone Tests - Asia/Kolkata (IST)');
  
  // Test 1: Current time
  console.group('1️⃣ Current Time Tests');
  const now = nowIST();
  const today = todayIST();
  console.log('Current IST Date Object:', now);
  console.log('Current IST Date String:', today);
  console.log('Timezone:', APP_TIMEZONE);
  console.groupEnd();
  
  // Test 2: UTC to IST conversion
  console.group('2️⃣ UTC to IST Conversion');
  const utcTimestamp = '2025-12-04T08:30:00Z'; // 8:30 AM UTC
  const istDate = toIST(utcTimestamp);
  console.log('UTC Input:', utcTimestamp);
  console.log('IST Output:', istDate);
  console.log('Expected: 14:00 IST (8:30 + 5:30)');
  console.log('Formatted:', formatDateTimeIST(utcTimestamp));
  console.groupEnd();
  
  // Test 3: Date formatting
  console.group('3️⃣ Date Formatting Tests');
  const testDate = '2025-12-04T12:00:00Z';
  console.log('Input:', testDate);
  console.log('formatDateTimeIST:', formatDateTimeIST(testDate));
  console.log('formatDateIST:', formatDateIST(testDate));
  console.log('formatTimeIST:', formatTimeIST(testDate));
  console.log('formatIST (custom):', formatIST(testDate, 'dd/MM/yyyy HH:mm'));
  console.groupEnd();
  
  // Test 4: Relative time
  console.group('4️⃣ Relative Time Tests');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log('2 hours ago:', formatDistanceToNowIST(twoHoursAgo));
  console.log('Yesterday:', formatDistanceToNowIST(yesterday));
  console.groupEnd();
  
  // Test 5: Backend date parsing
  console.group('5️⃣ Backend Date Parsing');
  const backendDates = [
    '2025-12-04T08:30:00Z',           // With Z
    '2025-12-04T08:30:00',            // Without Z (should assume UTC)
    '2025-12-04T08:30:00+05:30',     // With timezone
    '2025-12-04',                     // Date only
  ];
  backendDates.forEach(date => {
    console.log(`Input: ${date}`);
    console.log(`Parsed: ${formatBackendDateIST(date)}`);
  });
  console.groupEnd();
  
  // Test 6: Date-time components
  console.group('6️⃣ Date-Time Components (Attendance)');
  const dateStr = '2025-12-04';
  const timeStr = '08:30:00';
  const fullTimestamp = '2025-12-04T08:30:00Z';
  console.log('Separate components:');
  console.log(`  Date: ${dateStr}, Time: ${timeStr}`);
  console.log(`  Result: ${formatDateTimeComponentsIST(dateStr, timeStr, 'hh:mm a')}`);
  console.log('Full timestamp:');
  console.log(`  Input: ${fullTimestamp}`);
  console.log(`  Result: ${formatDateTimeComponentsIST(dateStr, fullTimestamp, 'hh:mm a')}`);
  console.groupEnd();
  
  // Test 7: Timezone offset verification
  console.group('7️⃣ Timezone Offset Verification');
  const utcDate = new Date('2025-12-04T12:00:00Z');
  const istDate2 = toIST(utcDate);
  const utcHours = utcDate.getUTCHours();
  const istHours = istDate2.getHours();
  const offset = istHours - utcHours;
  console.log('UTC Time:', utcDate.toISOString());
  console.log('IST Time:', istDate2.toString());
  console.log('UTC Hours:', utcHours);
  console.log('IST Hours:', istHours);
  console.log('Offset:', offset, 'hours');
  console.log('Expected Offset: 5.5 hours (5:30)');
  console.log('✅ Offset Correct:', Math.abs(offset - 5.5) < 0.1);
  console.groupEnd();
  
  // Test 8: Edge cases
  console.group('8️⃣ Edge Cases');
  console.log('Null date:', formatBackendDateIST(null));
  console.log('Undefined date:', formatBackendDateIST(undefined));
  console.log('Invalid date:', formatBackendDateIST('invalid-date'));
  console.log('Empty string:', formatBackendDateIST(''));
  console.groupEnd();
  
  console.groupEnd();
  
  return {
    timezone: APP_TIMEZONE,
    currentIST: now,
    todayIST: today,
    tests: 'completed',
  };
}

/**
 * Compare UTC and IST times side by side
 */
export function compareUTCandIST(utcTimestamp: string) {
  console.group('🔄 UTC vs IST Comparison');
  console.log('Input (UTC):', utcTimestamp);
  
  const utcDate = new Date(utcTimestamp);
  const istDate = toIST(utcTimestamp);
  
  console.table({
    'UTC': {
      'ISO String': utcDate.toISOString(),
      'Date': utcDate.toUTCString(),
      'Hours': utcDate.getUTCHours(),
      'Minutes': utcDate.getUTCMinutes(),
    },
    'IST': {
      'ISO String': istDate.toISOString(),
      'Date': istDate.toString(),
      'Hours': istDate.getHours(),
      'Minutes': istDate.getMinutes(),
    }
  });
  
  console.log('Formatted IST:', formatDateTimeIST(utcTimestamp));
  console.groupEnd();
}

/**
 * Test attendance time formatting
 */
export function testAttendanceFormatting() {
  console.group('📋 Attendance Time Formatting Tests');
  
  const testCases = [
    {
      date: '2025-12-04',
      time: '08:30:00',
      description: 'Separate date and time (UTC)',
    },
    {
      date: '2025-12-04',
      time: '2025-12-04T08:30:00Z',
      description: 'Date + full ISO timestamp',
    },
    {
      date: '2025-12-04',
      time: '2025-12-04T08:30:00',
      description: 'Date + ISO without Z',
    },
  ];
  
  testCases.forEach(({ date, time, description }) => {
    console.log(`\n${description}`);
    console.log(`Input: date="${date}", time="${time}"`);
    console.log(`Output: ${formatDateTimeComponentsIST(date, time, 'hh:mm a')}`);
  });
  
  console.groupEnd();
}

/**
 * Verify timezone is working correctly
 */
export function verifyTimezone() {
  const now = new Date();
  const istNow = nowIST();
  
  const utcHours = now.getUTCHours();
  const istHours = istNow.getHours();
  const offset = istHours - utcHours;
  
  // Account for day boundary
  const normalizedOffset = offset < -12 ? offset + 24 : offset > 12 ? offset - 24 : offset;
  
  const isCorrect = Math.abs(normalizedOffset - 5.5) < 0.1;
  
  console.log('🔍 Timezone Verification');
  console.log('Current UTC:', now.toISOString());
  console.log('Current IST:', istNow.toString());
  console.log('Offset:', normalizedOffset, 'hours');
  console.log('Expected: 5.5 hours');
  console.log(isCorrect ? '✅ Timezone is correct!' : '❌ Timezone offset is incorrect!');
  
  return isCorrect;
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).timezoneTests = {
    runTimezoneTests,
    compareUTCandIST,
    testAttendanceFormatting,
    verifyTimezone,
  };
  console.log('💡 Timezone test utilities loaded. Available commands:');
  console.log('  - timezoneTests.runTimezoneTests()');
  console.log('  - timezoneTests.compareUTCandIST("2025-12-04T08:30:00Z")');
  console.log('  - timezoneTests.testAttendanceFormatting()');
  console.log('  - timezoneTests.verifyTimezone()');
}
