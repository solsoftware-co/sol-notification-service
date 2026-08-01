## [1.1.2](https://github.com/solsoftware-co/sol-notification-service/compare/v1.1.1...v1.1.2) (2026-08-01)


### Bug Fixes

* **027:** promote production deployment now that domain auto-assign is off ([5596dbe](https://github.com/solsoftware-co/sol-notification-service/commit/5596dbea9aa86401e984144ae2bf77fbbfda1b26)), closes [#8](https://github.com/solsoftware-co/sol-notification-service/issues/8)

## [1.1.1](https://github.com/solsoftware-co/sol-notification-service/compare/v1.1.0...v1.1.1) (2026-07-31)


### Bug Fixes

* **027:** send x-inngest-env header when running e2e suite against staging ([8df024f](https://github.com/solsoftware-co/sol-notification-service/commit/8df024f8b4475f374950f446a6c87cf057401091))

# [1.1.0](https://github.com/solsoftware-co/sol-notification-service/compare/v1.0.0...v1.1.0) (2026-07-31)


### Bug Fixes

* **027:** deploy Preview ourselves instead of racing Vercel's auto-deploy ([0078ec3](https://github.com/solsoftware-co/sol-notification-service/commit/0078ec3d5d071419421eea2439d5c16025c9e9dc))
* **027:** extract deploy URL via grep instead of raw stdout capture ([d5d81b5](https://github.com/solsoftware-co/sol-notification-service/commit/d5d81b5ebd576f8eebb9acb3092c0e8004fa4680))
* **027:** force non-interactive mode for vercel env add in CI ([d6392e8](https://github.com/solsoftware-co/sol-notification-service/commit/d6392e87dc36f18283aac5224efb1134d8e21d12))
* **027:** serve local dev health check on /api/health to match Vercel deployment ([3274149](https://github.com/solsoftware-co/sol-notification-service/commit/3274149706eb33f24f893fb5edbc5372e44a0228))
* **027:** use --value/--yes for vercel env add instead of piped stdin ([a545d74](https://github.com/solsoftware-co/sol-notification-service/commit/a545d74ae2c041a5eddd4b058a912a3cd3a3383a))


### Features

* **027:** migrate client/notification-log access to sol-api HTTP client ([b0a00c2](https://github.com/solsoftware-co/sol-notification-service/commit/b0a00c28217f25befcdd81abd1d5501c9dece8d1))
* **027:** stop redirecting EMAIL_MODE=test sends, rely on payload recipients ([5f100c4](https://github.com/solsoftware-co/sol-notification-service/commit/5f100c4c7ede6a31de0e50cb53b9d94cd745fc56))
* **027:** support payload-level recipient override in weekly analytics report ([631af86](https://github.com/solsoftware-co/sol-notification-service/commit/631af867c38290181693d697136e3cf4618188da))

# 1.0.0 (2026-07-22)


### Bug Fixes

* **007:** resolve broken images and date formatting in email preview ([940ede4](https://github.com/solsoftware-co/sol-notification-service/commit/940ede427cb2f0f37ca530e8ec27deec21ed0c6f))
* **009:** skip build command and output dir for pure serverless project ([b372af0](https://github.com/solsoftware-co/sol-notification-service/commit/b372af061b43da8f740a724b0c0618f617301d8a))
* **009:** use inngest/node adapter — inngest/vercel not exported in v3 ([3abfe1f](https://github.com/solsoftware-co/sol-notification-service/commit/3abfe1f4669d9a11d25a77638291d6ed50c78d7f))
* **010:** add [TEST:] subject prefix in mailtrap email mode ([d247953](https://github.com/solsoftware-co/sol-notification-service/commit/d24795397ad3544a1ae5eed237b8acd8a5124198))
* **010:** add deployments and statuses read permissions to e2e workflow ([9df3c12](https://github.com/solsoftware-co/sol-notification-service/commit/9df3c1247c4d3520b543dba93c340514bea1e3a6))
* **010:** add pull-requests read permission to e2e workflow ([c8dc591](https://github.com/solsoftware-co/sol-notification-service/commit/c8dc5910fcd7c89663bc4ba470fe0be9439f66f3))
* **010:** add required reportPeriod and scheduledAt to weekly-analytics event data ([ee6b92d](https://github.com/solsoftware-co/sol-notification-service/commit/ee6b92d5137144ddafbec1007ada51a518acb55b))
* **010:** add verbose sync logging and try Inngest registration API ([7ca7aaa](https://github.com/solsoftware-co/sol-notification-service/commit/7ca7aaae652b720186a139303d29ae2918f4c1bb))
* **010:** add x-inngest-env header to run polling API call ([5066307](https://github.com/solsoftware-co/sol-notification-service/commit/50663073dbf9e642725f975afc9bad21c54c71be))
* **010:** exclude e2e tests from regular vitest run ([d2f45e2](https://github.com/solsoftware-co/sol-notification-service/commit/d2f45e20a588ccb440874070b5e08739345007bb))
* **010:** fetch html_body separately after finding matching message ([3ef28b2](https://github.com/solsoftware-co/sol-notification-service/commit/3ef28b25713eb9c5b7efe14c732e376a09905d31))
* **010:** increase e2e hook/test timeout to 5 minutes ([49fea70](https://github.com/solsoftware-co/sol-notification-service/commit/49fea70e303e20a21823660b116daa16d0b5f3f2))
* **010:** pass accountId to MailtrapClient constructor ([71ad17c](https://github.com/solsoftware-co/sol-notification-service/commit/71ad17c2b8b99176b1992ed703f644358155590a))
* **010:** pass attachments to nodemailer in mailtrap mode ([fd9101d](https://github.com/solsoftware-co/sol-notification-service/commit/fd9101ddac68573f0bfbd3375d24a8f6326515ae))
* **010:** pass x-inngest-env header for branch environment event routing ([ca79e3e](https://github.com/solsoftware-co/sol-notification-service/commit/ca79e3e1f0f665b2b9da12a122f82ec6ae53d9bd))
* **010:** remove accountId from messages.get() call — SDK v4 takes inboxId only ([ba067ea](https://github.com/solsoftware-co/sol-notification-service/commit/ba067ea4666625da26008c9dd7fd28e199b094bd))
* **010:** remove waitForRunCompletion — use email arrival as e2e signal ([2b99544](https://github.com/solsoftware-co/sol-notification-service/commit/2b99544b541021276b3deff9720e0eca8a2baa77))
* **010:** replace wait-for-vercel-preview action with Vercel API call ([71c8ab3](https://github.com/solsoftware-co/sol-notification-service/commit/71c8ab33f8e9ee1de73d6409331fbd01b3fe8838))
* **010:** switch e2e email transport to Mailtrap SMTP sandbox ([7a466d5](https://github.com/solsoftware-co/sol-notification-service/commit/7a466d5ee024b1307b1233c4bf20b506a0920dbf))
* **010:** sync Inngest app with Vercel Preview before running e2e tests ([ece47c0](https://github.com/solsoftware-co/sol-notification-service/commit/ece47c0a78bb533e4dc0652bd7c0b01d4cdf49c3))
* **010:** use flow-specific subject patterns in waitForEmail ([438d656](https://github.com/solsoftware-co/sol-notification-service/commit/438d656bc76c68a2ad22ad220202806594ddb79a))
* **011:** use pg directly in migration runner instead of @neondatabase/serverless ([73c09c7](https://github.com/solsoftware-co/sol-notification-service/commit/73c09c7b6103fbc37059b1d141cf45f5b2d8c82c))
* **011:** use tsx directly in CI migration steps to avoid missing .env.local ([e85b0f0](https://github.com/solsoftware-co/sol-notification-service/commit/e85b0f0fc3bf97007ad4d35d3945a4a83402d883))
* **020:** snapshot resolved banner config in notification_logs.metadata at send time ([a04093e](https://github.com/solsoftware-co/sol-notification-service/commit/a04093ecfa2fbbbc29b40b76bd10e7ccde94cb74))
* **023:** add setRunContext to logger mocks in unit tests ([cd4ca06](https://github.com/solsoftware-co/sol-notification-service/commit/cd4ca062c478bd3bdadd55695e3db3e9998fba7a))
* **025:** resolve npm ci lockfile mismatch from inngest bump ([b82eba7](https://github.com/solsoftware-co/sol-notification-service/commit/b82eba7f8e081204a39b3c9055a4774f6146625d))
* **025:** update inngest to 3.54.2 to resolve known vulnerability ([6dd60ca](https://github.com/solsoftware-co/sol-notification-service/commit/6dd60caadee89bf52c061ffb7b0b51d7eaaa04fa))
* **analytics:** return mock data when propertyId is null or absent ([ed3f168](https://github.com/solsoftware-co/sol-notification-service/commit/ed3f168ced9b3f019e362e8f8f98f81dfd9a8a78))
* **e2e:** skip analytics report only in live mode, add run completion wait ([3c560c5](https://github.com/solsoftware-co/sol-notification-service/commit/3c560c5265d3db257a52c5ed2c3bf2c436dfb55b))
* **e2e:** tighten chart attachment pattern, add xlsx assertion ([67a52c7](https://github.com/solsoftware-co/sol-notification-service/commit/67a52c73f10fa73ba092de505bdc2e72fb58b357))
* **emails:** use shading background color for stat cards ([3573f21](https://github.com/solsoftware-co/sol-notification-service/commit/3573f21c77886b53a70105e8feb0cfeae616a713))
* **preview:** remove max-width cap — preview fills full viewport width ([20ed4bc](https://github.com/solsoftware-co/sol-notification-service/commit/20ed4bcb5f828154e3365ff10cd76159a313a0f8))


### Features

* **001:** Inngest dev server setup ([99e00cc](https://github.com/solsoftware-co/sol-notification-service/commit/99e00cc407c14693b00f78f191e23203e14c56ca))
* **002:** core shared infrastructure ([a954079](https://github.com/solsoftware-co/sol-notification-service/commit/a9540791bcc8a13f5b5bcdbc66e8315198a16d73))
* **003:** form submission notification workflow ([b3de7f6](https://github.com/solsoftware-co/sol-notification-service/commit/b3de7f668efaf2eee3e7b1a7db53e9c06d7e4a98))
* **004:** automated test suite and CI pipeline ([3aa979d](https://github.com/solsoftware-co/sol-notification-service/commit/3aa979d584808957e36f789eab27cbbe61403fbc))
* **005:** weekly analytics report workflow ([a0d3f6a](https://github.com/solsoftware-co/sol-notification-service/commit/a0d3f6a69e215d30463c103da54fe603a0092eff))
* **006:** logo, brand colours, and button polish ([36c9d1a](https://github.com/solsoftware-co/sol-notification-service/commit/36c9d1a64b13857cb67af9726c29500871d7f319)), closes [#36363B](https://github.com/solsoftware-co/sol-notification-service/issues/36363B) [#5E96C7](https://github.com/solsoftware-co/sol-notification-service/issues/5E96C7) [#F7BC03](https://github.com/solsoftware-co/sol-notification-service/issues/F7BC03)
* **006:** professional email template system ([5437503](https://github.com/solsoftware-co/sol-notification-service/commit/54375031e9dec2b415fe8201843eea44837b077d))
* **007:** analytics email charts with QuickChart integration ([f5556b4](https://github.com/solsoftware-co/sol-notification-service/commit/f5556b4144f894d6648f558ecc4f6fc26389dcc3))
* **007:** chart polish — data labels, formatting, and layout tweaks ([19ddb5d](https://github.com/solsoftware-co/sol-notification-service/commit/19ddb5d9251a117ff04f60749f6f5fd569761fa1))
* **008:** structured logging with Pino + Better Stack ([a19cd99](https://github.com/solsoftware-co/sol-notification-service/commit/a19cd99afe556fa3fa0a1ba4d68e8e283ea7727f))
* **009:** add Vercel adapter files and deployment spec ([074ebd1](https://github.com/solsoftware-co/sol-notification-service/commit/074ebd1fa412b4ba3a6ae3a5102025b8e323912e))
* **010:** add automated e2e email testing pipeline ([98a03ff](https://github.com/solsoftware-co/sol-notification-service/commit/98a03ff323f4270fb394777bf86acab180288f69))
* **010:** add PR summary to ci-gate with per-flow pass/fail status ([3a19d88](https://github.com/solsoftware-co/sol-notification-service/commit/3a19d88f9bc72f7383bad9efc593815f6c15e75e))
* **010:** added same banner image check from the form notification to the weekly analytics ([e86d166](https://github.com/solsoftware-co/sol-notification-service/commit/e86d1666d3c62a2b05c0d5a28a86145929ee9a5c))
* **010:** assert inline image attachments via Mailtrap attachments API ([3826e31](https://github.com/solsoftware-co/sol-notification-service/commit/3826e317472d574e1ee0b7a609c2f0403abafa0a))
* **010:** assert Sol Software banner CID attachment in form-notification e2e test ([ad14d61](https://github.com/solsoftware-co/sol-notification-service/commit/ad14d61780e8183f1a05a120faffea734d68d2ef))
* **011:** add versioned database migration system ([9bb6276](https://github.com/solsoftware-co/sol-notification-service/commit/9bb6276225da8f24fd27796466479a58e68630ef))
* **011:** apply migrations to test db before prod on merge to main ([2cb665c](https://github.com/solsoftware-co/sol-notification-service/commit/2cb665c79dd5d6e8996aa6261d80931ada0eb6f1))
* **012:** add notification send logging to audit trail ([9afaad3](https://github.com/solsoftware-co/sol-notification-service/commit/9afaad3d4b01e3a28c38cc7de9874b727a908f38))
* **013:** add email-safe trend arrow to StatCard metric label ([17134a2](https://github.com/solsoftware-co/sol-notification-service/commit/17134a267b28b69a6c2e19814b770d2ddd9d7ab1)), closes [#F7BC03](https://github.com/solsoftware-co/sol-notification-service/issues/F7BC03) [#C97B7B](https://github.com/solsoftware-co/sol-notification-service/issues/C97B7B)
* **013:** attach Excel spreadsheet to analytics report emails ([24d3623](https://github.com/solsoftware-co/sol-notification-service/commit/24d3623459de767c60701dac752c7bf6ac7486fd))
* **013:** dynamic report title based on period preset ([05c8248](https://github.com/solsoftware-co/sol-notification-service/commit/05c8248ce8749e9f8969592d5e9d6947a4d92a4f))
* **013:** friendly metric labels, sublabel under number, label spacing ([d1dd9b2](https://github.com/solsoftware-co/sol-notification-service/commit/d1dd9b2349a3b65d5db74cf191b2e447140935d2))
* **013:** human-readable page names in top pages chart and table ([26c3b68](https://github.com/solsoftware-co/sol-notification-service/commit/26c3b688e568be48ebbddebdb4e679451905c06c))
* **013:** human-readable page names in top pages chart and table ([55e294e](https://github.com/solsoftware-co/sol-notification-service/commit/55e294e16015e63e73eaeda0f06e080a81521425))
* **013:** preset-aware bar labels and suppress history for custom ranges ([ee114b1](https://github.com/solsoftware-co/sol-notification-service/commit/ee114b125d33a4f7a387be99f7d4202c04afaf4a))
* **013:** redesign stat cards with historical context and bar charts ([8da9aba](https://github.com/solsoftware-co/sol-notification-service/commit/8da9aba7ae834ad7a12bd642b3998b42e95a08e2))
* **013:** replace traffic sources pie chart with gauge charts ([d957219](https://github.com/solsoftware-co/sol-notification-service/commit/d957219932714a5c49b1adb20bea617774dc79e0)), closes [#A1A1AA](https://github.com/solsoftware-co/sol-notification-service/issues/A1A1AA)
* **013:** restyle charts with muted colors and cleaner axes ([15e0308](https://github.com/solsoftware-co/sol-notification-service/commit/15e03084752b9e596683e96e0763de93b144efe5))
* **013:** tighten bar spacing and fix equal bar widths ([28815b9](https://github.com/solsoftware-co/sol-notification-service/commit/28815b98f89de32f57ada1d1b2d9bc863a8f5c97))
* **014:** add per-client notification preferences with recipient resolution ([83c20b2](https://github.com/solsoftware-co/sol-notification-service/commit/83c20b22e717d3b2e47594388811f0d3e4054309))
* **015:** flexible form notification fields ([eb91af0](https://github.com/solsoftware-co/sol-notification-service/commit/eb91af07d314a0e53ec2fad2b68519706658a89c))
* **016:** google sheets sink + per-client google credentials ([1523880](https://github.com/solsoftware-co/sol-notification-service/commit/1523880397adb98b9cd6b39f0000036271b64e12))
* **017:** per-invocation recipient override for form notifications ([81c4069](https://github.com/solsoftware-co/sol-notification-service/commit/81c40691917a510507ea2da70ada1348fcf57911))
* **018:** add notificationTitle payload field to override email header ([8a7c146](https://github.com/solsoftware-co/sol-notification-service/commit/8a7c1460c0b10b1fb7d5eabf2d76394a9de9311f))
* **018:** form notification payload controls — sendEmail toggle + configurable CTA button ([7886329](https://github.com/solsoftware-co/sol-notification-service/commit/788632978a7bc255761a57e1ea4ab72a3acd8959))
* **019:** per-client email banner — custom image URL, dimensions, and validation logging ([6a9193f](https://github.com/solsoftware-co/sol-notification-service/commit/6a9193f8883e4fbaabda4f4fdb2d00b4784b27dd))
* **021:** configurable tableAnchor for Google Sheets destination ([879de1c](https://github.com/solsoftware-co/sol-notification-service/commit/879de1c47432199c8d801f52fc877efd821d1f91))
* **021:** monthly analytics scheduler with US business-day enforcement ([2bb6bf7](https://github.com/solsoftware-co/sol-notification-service/commit/2bb6bf729043a49119e90e16271c4b31f560476a))
* **022:** add enforceDeliveryWindow flag — manual triggers send immediately ([7c14209](https://github.com/solsoftware-co/sol-notification-service/commit/7c1420979f7eb4eccb51a66107509d1c65a96d8e))
* **022:** per-client timezone — 9 AM local delivery with DST-aware business-day check ([72b2d60](https://github.com/solsoftware-co/sol-notification-service/commit/72b2d606e43e88c00c286e0322d97a0630e8e58b))
* **023:** plain-English logging with AsyncLocalStorage run correlation ([6ef9a35](https://github.com/solsoftware-co/sol-notification-service/commit/6ef9a35042450cf20999e2452cb497d532403e56)), closes [#30](https://github.com/solsoftware-co/sol-notification-service/issues/30)
* per-preset GA4 fetch limits with optional event-level overrides ([485e132](https://github.com/solsoftware-co/sol-notification-service/commit/485e132709083def1dbc28dddacd95ac69fdd216))
