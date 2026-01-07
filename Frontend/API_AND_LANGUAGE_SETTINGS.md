# API and Language Settings Documentation

This document Provides a comprehensive guide on how the API services and Language/Localization settings are implemented and used in the Shekru Labs India Employee Management System.

---

## 1. API Architecture

All backend communication is centralized in the `ApiService` class found in `@/lib/api.ts`.

### Configuration
- **Base URL**: Controlled by the `API_BASE_URL` constant.
- **Environment**: Uses `import.meta.env.VITE_API_BASE_URL` with a fallback to `https://staffly.space`.
- **Authentication**: JWT tokens are automatically attached to the Authorization header from `localStorage`.

### Key Components
- **File**: `src/lib/api.ts`
- **Instance**: `apiService` (exported for global use).

### Usage Example
```typescript
import { apiService } from '@/lib/api';

// Fetching data
const employees = await apiService.getEmployees();

// Posting data
const newEmployee = await apiService.createEmployee(employeeData);
```

### Request Interceptor Logic
The `request` method handles:
1. Attaching `Bearer` tokens.
2. Error handling (extracting error messages from JSON or status text).
3. 401/403 Handling: Automatically clears local storage and redirects to `/login` if the session expires.

---

## 2. Language & Localization Settings

The app supports multiple languages (English, Hindi, Marathi) using a custom React Context and Translation system.

### Core Files
- **Translations Storage**: `src/i18n/translations.ts`
- **Language Context**: `src/contexts/LanguageContext.tsx`
- **Settings Toggle**: `src/pages/settings/SettingsPage.tsx`

### How to use in Components
Use the `useLanguage` hook to access the translation object (`t`) and the current language.

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

const MyComponent = () => {
  const { t, language } = useLanguage();

  return (
    <div>
      <h1>{t.common.welcome}</h1>
      <p>Current Language: {language}</p>
    </div>
  );
};
```

---

## 3. Adding New Translations

To add a new string or support a new part of the UI:

1.  Open `src/i18n/translations.ts`.
2.  Add your key-value pairs to the `en` (English) object.
3.  Add corresponding translations to the `hi` (Hindi) and `mr` (Marathi) objects.

### Adding a New Language
1.  Add the new language code to the `Language` type:
    ```typescript
    export type Language = 'en' | 'hi' | 'mr' | 'your_code';
    ```
2.  Add a new section in the `translations` object with the same structure as English.
3.  Update `SettingsPage.tsx` and `MainLayout.tsx` (Language Selector) to include the new option in the UI.

---

## 4. Persistent Settings

Language and other user preferences are stored in `localStorage` to persist across refreshes.

- **Storage Keys**:
  - `language`: Global language preference.
  - `language_{userId}`: User-specific language preference (prioritized).
  - `themeMode`: Theme preference (light/dark/system).
  - `colorTheme`: UI color scheme preference.

### Settings UI
Users can modify these settings via the **Settings** page (`/admin/settings`, `/employee/settings`, etc.). The page uses the `useLanguage` and `useTheme` hooks to trigger live updates across the whole application.

---

## 5. Summary of API Endpoints (Frequently Used)

| Feature | Endpoint Path | Method |
|---------|---------------|--------|
| Auth Status | `/attendance/status` | GET |
| Check In | `/attendance/check-in` | POST |
| Leave Balance | `/leave/balance` | GET |
| Dashboard Data | `/dashboard/admin` | GET |
| Tasks | `/tasks` | GET |
| Employee List | `/employees` | GET |

---
*Last Updated: January 6, 2026*
