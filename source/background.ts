import {browser} from 'webextension-polyfill-ts';
import {
  error,
  getManifest,
  getNextQItem,
  getSettings,
  newQItemID,
  QItem,
  QMessage,
  removeQItem,
  saveSettings
} from '.';

let timeoutID: number | null = null;

browser.browserAction.onClicked.addListener(async () => {
  // When the extension icon is initially clicked, create a timeout for 500ms
  // that will open the next queue item when it expires.
  // If the icon is clicked again in those 500ms, open the options page instead.
  if (timeoutID === null) {
    timeoutID = window.setTimeout(async () => {
      timeoutID = null;
      const nextItem = await getNextQItem();

      if (nextItem === undefined) {
        await openOptionsPage();
      } else {
        const tabs = await browser.tabs.query({
          currentWindow: true,
          active: true
        });

        const message: QMessage<QItem> = {
          action: 'queue open url',
          data: nextItem
        };

        await browser.tabs.sendMessage(tabs[0].id!, message);
        await removeQItem(nextItem.id);
      }
    }, 500);
  } else {
    window.clearTimeout(timeoutID);
    timeoutID = null;
    await openOptionsPage();
  }
});

browser.runtime.onInstalled.addListener(async () => {
  const manifest = getManifest();
  const settings = await getSettings();

  // Open the options page when:
  // * The extension is first installed or is updated.
  // * In development, for convenience.
  if (
    manifest.version !== settings.latestVersion ||
    manifest.nodeEnv === 'development'
  ) {
    settings.latestVersion = manifest.version;
    await saveSettings(settings);
    await openOptionsPage();
  }
});

async function openOptionsPage() {
  return browser.runtime.openOptionsPage();
}

/**
 * The callback function for custom context menu entries.
 */
function contextCreated() {
  if (
    browser.runtime.lastError !== null &&
    browser.runtime.lastError !== undefined
  ) {
    error(browser.runtime.lastError);
  }
}

browser.contextMenus.create(
  {
    id: 'queue-add-new-link',
    title: 'Add to Queue',
    contexts: ['link']
  },
  contextCreated
);

browser.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'queue-add-new-link') {
    const settings = await getSettings();

    settings.queue.push({
      added: new Date(),
      id: newQItemID(settings.queue),
      text: info.linkText!,
      url: info.linkUrl!
    });

    await saveSettings(settings);
  }
});