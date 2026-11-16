/*
 * Tieba feed / splash ad cleaner (Shadowrocket http-response script)
 * ------------------------------------------------------------------
 * Removes ad fields and ad cards from JSON responses; everything else
 * is returned untouched.
 *
 * No network access, no storage, no data collection. Pure string
 * processing on $response.body. Fail-open: any error returns the
 * response unchanged.
 * ------------------------------------------------------------------
 * [Script] usage:
 * name = type=http-response,pattern=^https?://(c\.tieba|tiebac)\.baidu\.com/c/(f/(frs/(page|threadlist|generalTabList)|pb/(pic)?page)|b/ad/adBid),requires-body=1,max-size=0,script-path=<URL of this file>
 */

(function () {
  'use strict';

  var MAX_DEPTH = 12;

  // Object keys that hold ad containers: drop the whole key
  var AD_KEYS = [
    'ad', 'ad_data', 'adData', 'ad_info', 'adInfo',
    'advert', 'advertisement', 'advertisement_info',
    'splash', 'splash_ad', 'splashAd'
  ];

  // Array items carrying these markers are ad cards: drop the item
  function isAdItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

    var i, v;
    var flagKeys = ['is_ad', 'is_advert', 'isAd', 'isAdvert', 'is_advertisement'];
    for (i = 0; i < flagKeys.length; i++) {
      v = item[flagKeys[i]];
      if (v === true || v === 1 || v === '1') return true;
    }

    var idKeys = ['ad_id', 'adId', 'adid'];
    for (i = 0; i < idKeys.length; i++) {
      v = item[idKeys[i]];
      if (v && v !== 0 && v !== '0') return true;
    }

    var typeKeys = ['ad_type', 'adType', 'adtype'];
    for (i = 0; i < typeKeys.length; i++) {
      v = item[typeKeys[i]];
      if (v && v !== 0 && v !== '0') return true;
    }

    // type: "ad" / "thread_ad" / "ad_thread"
    var kindKeys = ['type', 'thread_type', 'card_type'];
    for (i = 0; i < kindKeys.length; i++) {
      v = item[kindKeys[i]];
      if (typeof v === 'string' && /(^|[_\-\s])ad([_\-\s]|$)/i.test(v)) return true;
    }

    return false;
  }

  function strip(node, depth) {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;

    if (Array.isArray(node)) {
      for (var i = node.length - 1; i >= 0; i--) {
        if (isAdItem(node[i])) node.splice(i, 1);
        else strip(node[i], depth + 1);
      }
      return;
    }

    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      if (AD_KEYS.indexOf(k) !== -1) {
        try { delete node[k]; } catch (e) { node[k] = null; }
        continue;
      }
      strip(node[k], depth + 1);
    }
  }

  try {
    var raw = $response && $response.body ? String($response.body) : '';
    var head = raw.replace(/^\s+/, '').charAt(0);

    // JSON object/array only; binary (protobuf) passes through
    if (head !== '{' && head !== '[') {
      $done({});
      return;
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      $done({});
      return;
    }

    strip(data, 0);

    $done({ body: JSON.stringify(data) });
  } catch (e) {
    $done({});
  }
})();
