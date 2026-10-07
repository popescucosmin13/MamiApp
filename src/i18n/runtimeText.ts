import React from 'react';
import { Alert } from 'react-native';
import i18n from './index';
import hardcoded from '../locales/hardcoded.json';

type Lang = 'ro' | 'en';

const sourceMap = hardcoded as Record<Lang, Record<string, string>>;
let installed = false;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function translateHardcodedText(value: string): string {
  const lang: Lang = i18n.language === 'en' ? 'en' : 'ro';
  const normalized = normalizeText(value);
  if (!normalized) return value;
  if (lang === 'en') {
    const dynamic = normalized
      .replace(/^Răspunde lui (.+)\.\.\.$/, 'Reply to $1...')
      .replace(/^Activități recomandate pentru (.+) luni \((.+) luni\)$/, 'Recommended activities for $1 months ($2 months)')
      .replace(/^Activități personalizate pentru (.+) tău$/, 'Personalized activities for your $1')
      .replace(/^Exportul conține datele copilului (.+)\.$/, 'The export contains data for $1.');
    if (dynamic !== normalized) return value.replace(normalized, dynamic);
  }
  const translated = sourceMap[lang]?.[normalized];
  if (!translated) return value;
  return value.replace(normalized, translated);
}

function translateNode(node: unknown): unknown {
  if (typeof node === 'string') return translateHardcodedText(node);
  if (Array.isArray(node)) return node.map(translateNode);
  return node;
}

function translateDeep(value: unknown): unknown {
  if (typeof value === 'string') return translateHardcodedText(value);
  if (Array.isArray(value)) return value.map(translateDeep);
  if (value && typeof value === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const translated = translateDeep(child);
      next[key] = translated;
      if (translated !== child) changed = true;
    }
    return changed ? next : value;
  }
  return value;
}

function translateProps(props: any) {
  if (!props) return props;
  let next = props;
  const keys = [
    'placeholder',
    'accessibilityLabel',
    'title',
    'label',
    'subtitle',
    'description',
    'text',
    'text1',
    'text2',
    'buttonTitle',
    'headerTitle',
  ];
  for (const key of keys) {
    if (typeof props[key] === 'string') {
      if (next === props) next = { ...props };
      next[key] = translateHardcodedText(props[key]);
    }
  }
  for (const key of ['options', 'screenOptions', 'data']) {
    if (props[key] && typeof props[key] === 'object') {
      const translated = translateDeep(props[key]);
      if (translated !== props[key]) {
        if (next === props) next = { ...props };
        next[key] = translated;
      }
    }
  }
  if (props.children !== undefined) {
    const translatedChildren = translateNode(props.children);
    if (translatedChildren !== props.children) {
      if (next === props) next = { ...props };
      next.children = translatedChildren;
    }
  }
  return next;
}

export function installRuntimeTextTranslations() {
  if (installed) return;
  installed = true;

  const originalCreateElement = React.createElement;
  React.createElement = ((type: any, props: any, ...children: any[]) => {
    const translatedProps = translateProps(props);
    const translatedChildren = children.map(translateNode);
    return originalCreateElement(type, translatedProps, ...(translatedChildren as React.ReactNode[]));
  }) as typeof React.createElement;

  const originalAlert = Alert.alert;
  Alert.alert = ((title: string, message?: string, buttons?: any, options?: any) => {
    const nextButtons = Array.isArray(buttons)
      ? buttons.map((button) => (
          button && typeof button.text === 'string'
            ? { ...button, text: translateHardcodedText(button.text) }
            : button
        ))
      : buttons;
    return originalAlert(
      typeof title === 'string' ? translateHardcodedText(title) : title,
      typeof message === 'string' ? translateHardcodedText(message) : message,
      nextButtons,
      options,
    );
  }) as typeof Alert.alert;
}
