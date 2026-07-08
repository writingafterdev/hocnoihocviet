/**
 * Get config object for Google Analytics
 * NB values in comments are from /interactive/repression-in-putins-russia/
 * and can probably be removed at some point but exist for reference
 * @param {Object} obj
 * @param {string} obj.pathname window.location.pathname
 * @return {config} obj.interaction interaction
 */
const getTedlConfig = ({ pathname }) => {
  return {
    events: window?.tedl?.events || [],
    platform: {
      id: 'economist_bespoke_site', // economist_interactive_site
      type: 'site',
      name: 'economist.edotcom.site.all',
      purpose: 'bespoke_framework', // interactive
      technology: 'all',
      version: '0.1',
      environment: 'prod',
      brand_parent: 'economist',
      brand_child: 'edotcom',
      variant: 'bespoke_framework', // 'projects'
    },
    screen: {
      name: pathname,
      type: 'bespoke_framework', // interactive
      hierarchy: [],
    },
    user: { status: '' },
    ads: {},
  };
};

/**
 * Append script to head
 * @param {Object} obj
 * @param {string} obj.src script src
 * @param {string} obj.id script id
 */
const appendScriptToHead = ({ src, id }) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (id) {
      script.id = id;
    }
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/**
 * Append script to body
 * @param {Object} obj
 * @param {string} obj.src script src
 * @param {string} obj.id script id
 */
const appendScriptToBody = ({ src, id }) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (id) {
      script.id = id;
    }
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

async function loadAnalytics(isProd) {
  const env = isProd ? 'prod' : 'qa';

  await appendScriptToHead({
    src: `https://tags.tiqcdn.com/utag/teg/core/${env}/utag.js`,
  });

  // SourcePoint handles the consent exemption for core and espresso apps based on query parameters
  await appendScriptToHead({
    src: `//cmp-cdn.p.aws.economist.com/latest/configs/economist${
      isProd ? '' : '.stage'
    }.config.js`,
  });
  await appendScriptToHead({
    src: '//cmp-cdn.p.aws.economist.com/latest/cmp.min.js',
  });

  await appendScriptToBody({
    src: '//cdn.parsely.com/keys/economist.com/p.js',
    id: 'parsely-cfg',
  });

  window.tedl = Object.assign(
    window.tedl,
    getTedlConfig({ pathname: window.location.pathname }),
  );
}

async function updatePage() {
  // we expect the bespoke framework to provide some feature flags
  const flags = window.bespokeFlags || {
    isProd: true,
    noAnalytics: false,
  };

  const { isProd, noAnalytics } = flags;

  if (!noAnalytics) {
    loadAnalytics(isProd);
  }
}

setTimeout(updatePage, 10);
