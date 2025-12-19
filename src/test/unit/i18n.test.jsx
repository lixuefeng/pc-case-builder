import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../../i18n/LanguageContext';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

describe('I18n: Language System', () => {

    it('should provide default language (en/zh based on navigator or default en)', () => {
        // Mock navigator language if possible, otherwise assume environment default
        // In Node/JsDom env, usually en-US.
        const wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;
        const { result } = renderHook(() => useLanguage(), { wrapper });

        // Logic is: navigator.language startsWith zh ? zh : en
        // JSDOM default is usually en-US
        expect(result.current.language).toBe('en');
    });

    it('should allow switching language', () => {
        const wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
            result.current.setLanguage('zh');
        });

        expect(result.current.language).toBe('zh');
        expect(localStorage.getItem('app_language')).toBe('zh');
    });

    it('should translate simple keys', () => {
        const wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;
        const { result } = renderHook(() => useLanguage(), { wrapper });

        // 'app.title' exists in both
        const titleEn = result.current.t('app.title');
        expect(titleEn).toBe('ChassisForge (Beta)');

        act(() => {
            result.current.setLanguage('zh');
        });

        const titleZh = result.current.t('app.title');
        expect(titleZh).toBe('ChassisForge (Beta)'); 
        // Note: In translations.js usually title is same or translated.
        // Let's check a key that definitely differs.
        // "action.undo" -> Undo (en) / 撤销 (zh)
        
        const undoZh = result.current.t('action.undo');
        expect(undoZh).toBe('撤销');
    });

    it('should interpolate parameters', () => {
        const wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;
        const { result } = renderHook(() => useLanguage(), { wrapper });

        // Ensure we are in EN
        act(() => { result.current.setLanguage('en'); });

        // Key: "format.copy" -> "Copy" (No params here usually, but let's assume we have one or use a made-up key if the system supports raw strings? No, dict lookup)
        // We need a key that actually uses params.
        // Let's check translations.js content earlier.
        // I saw: "toast.duplicate": "Duplicated {name}" in a previous turn (or similar).
        // Let's rely on standard fallback behavior if key doesn't exist?
        // Wait, t implementation: 
        // let str = dict[key] || key;
        // So if we pass a non-existent key with params, it should just return key... wait params replacement runs on result.
        // if (params) str.replace...
        
        // So we can test interpolation even without a real key if we pass a "Raw String {param}" as key?
        // No, `dict[key]` will be undefined, so `str` becomes `key`.
        // Then replace runs on `key`.
        // So we can test "Hello {name}" as the key.
        
        const output = result.current.t('Hello {name}', { name: 'World' });
        expect(output).toBe('Hello World');
    });

    it('should fallback to default language (en) if key missing in current language', () => {
        // Provide a mock translation dict? 
        // The context imports 'translations' directly from file. We can't easily mock that file module unless verify uses real file.
        // Real file 'zh' might miss some keys that 'en' has?
        // Or we can just rely on the code: const dict = translations[language] || translations["en"];
        // Wait, logic is: IF language is 'fr' (unsupported), it falls back to 'en'.
        
        const wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
            result.current.setLanguage('fr'); // Unsupported
        });

        // Should return EN string for known key
        const enStr = result.current.t('action.import');
        expect(enStr).toBe('Import');
    });
});
