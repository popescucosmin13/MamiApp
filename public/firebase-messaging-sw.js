// Legacy Firebase Messaging entrypoint.
// The app uses one root-scoped service worker so PWA caching, updates,
// timer notifications, and Firebase background push all share the same scope.
importScripts('/sw-custom.js');
