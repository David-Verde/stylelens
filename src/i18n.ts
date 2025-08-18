import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let translations: { [key: string]: string } = {};

export function initialize(context: vscode.ExtensionContext) {
    const language = vscode.env.language.split('-')[0];
    const defaultBundlePath = path.join(context.extensionPath, 'l10n', 'bundle.l10n.json');
    const localeBundlePath = path.join(context.extensionPath, 'l10n', `bundle.l10n.${language}.json`);

    try {
        const defaultBundle = JSON.parse(fs.readFileSync(defaultBundlePath, 'utf8'));
        const localeBundle = fs.existsSync(localeBundlePath)
            ? JSON.parse(fs.readFileSync(localeBundlePath, 'utf8'))
            : {};
        
        translations = { ...defaultBundle, ...localeBundle };
    } catch (error) {
        console.error('StyleLens: Error loading translation files.', error);
        try {
             translations = JSON.parse(fs.readFileSync(defaultBundlePath, 'utf8'));
        } catch (e) {
            translations = {};
        }
    }
}

export function t(key: string): string {
    return translations[key] || key; 
}

export function getTranslations(): { [key: string]: string } {
    return translations;
}