# Client app: training videos, uploaded files and private previews

Updated 21 November 2026. Applies to `fondeka-expo` (React Native / Expo), alongside the related `fondeka-web` training improvements.

## Implemented client behavior

- Training YouTube videos play inside the app, for purchased lessons and saved author previews. A separate **Open on YouTube** action remains available.
- Uploaded video files use the native video player, with controls and fullscreen. Playback starts only after a user action. Closing the viewer, leaving the screen or backgrounding the app removes the player.
- File cards show the filename, format and known size for training materials and digital product uploads. Long filenames wrap. Unknown size is omitted, rather than displayed as zero.
- The training editor has **Preview training**. It shows the last saved curriculum, published lessons by default, and an **Include draft lessons** switch. Completion toggles affect only that preview session.
- Digital products have **Customer preview** in the creation review step and product editor. It uses the current form's image, title, description, price and file summary. It does not create an order or save/publish the product. Download links and delivery secrets are not included in this presentation.
- English and French labels are included.

## Main code

| File | Responsibility |
| --- | --- |
| `src/utils/commerceTrainingVideo.js` | HTTPS checks, exact YouTube host/ID recognition, canonical embed URL, access expiry and native WebView identity |
| `src/utils/commerceFileMetadata.js` | File metadata normalization, localized binary sizes, retention of upload metadata through draft saves |
| `src/screens/CommerceScreen/components/TrainingMaterialViewer.js` | Fresh access request, video/document viewer, retry, expiration and background lifecycle |
| `src/screens/CommerceScreen/components/CommerceFileDetails.js` | Reusable filename / format / size display |
| `src/screens/CommerceScreen/components/TrainingCurriculumPreview.js` | Saved author curriculum preview with optional drafts and local progress |
| `src/screens/CommerceScreen/components/DigitalProductPreview.js` | Private customer presentation preview from the current form |
| `TrainingPlayerScreen.js`, `TrainingCurriculumScreen.js` | Learner and author integration |
| `CreateProductScreen.js`, `ProductDetailScreen.js` | Digital upload metadata and customer preview integration |

The video implementation uses the existing `react-native-webview`, `expo-video`, `expo-application` and `expo-constants` dependencies. It adds no packages or backend endpoints.

## Access and playback contract

Always obtain access through the authenticated endpoint for the current role:

```text
Author:
GET /customer-api/commerce/products/{productId}/training/materials/{materialId}/access

Learner:
GET /customer-api/commerce/trainings/{productId}/materials/{materialId}/access
```

The response is expected to contain `materialId`, `type` (`FILE` or `LINK`), `url`, and optional `expiresAt`, `fileName` and `contentType`. File access must have a valid future `expiresAt`. The viewer checks that the returned material ID matches the selected material before displaying its content. Curriculum URLs and `linkProvider` hints are not substitutes for authorization.

YouTube watch, share, Shorts, live and embed URLs are converted to a fixed `youtube-nocookie.com` embed after access succeeds. Only a valid individual video ID and supported start time are retained. User HTML, arbitrary embed hosts, URL credentials and non-HTTPS schemes are not embedded. Native WebView requests identify the installed application through an origin-only `Referer` derived from `expo-application.applicationId`, with the configured platform application ID as a fallback. No API authorization headers are sent to YouTube.

This follows [YouTube's native WebView identification guidance](https://developers.google.com/youtube/terms/required-minimum-functionality). Preserve the application identity when changing the player: browser referrer behavior cannot be assumed in a native WebView.

Uploaded video URLs are passed to `expo-video` exactly as returned, including the signed query string. Do not normalize, log, persist or share these short-lived URLs through application storage. On expiry, the viewer removes both the player and its fallback action. **Refresh access** requests a new authorized URL. Error messages do not expose signed URLs.

Provider restrictions still apply. Embedding-disabled or restricted YouTube videos may require the fallback action. Unsupported uploaded codecs display a retry/fallback path; the client does not extract YouTube media streams or bypass provider controls.

## File metadata and backend limits

Both existing upload helpers already return the original filename, MIME type and actual uploaded size. Update displayed metadata only after a successful upload. A failed replacement must retain the previous asset and its details; removing an asset clears its local metadata.

Training curriculum writes retain the existing allowlist:

```text
version
modules[].id, title, description, published
modules[].materials[].id, title, description, type, published,
                       assetKey, fileName, linkUrl
```

Do not add `contentType` or `fileSize` to curriculum writes until the backend explicitly accepts them. Successful upload metadata is retained in memory by asset key when a draft save response omits it. Server-supplied metadata remains authoritative when present.

For digital products, the current product API persists `digitalAssetKey` but does not guarantee the original filename, content type or size in its resource. The app shows complete details after uploading and retains them through saves in the current editor session. After reopening, only the stored key's basename/extension may be available. Do not invent a size or expose the entire private storage key. Full metadata across app restarts needs backend resource support for original filename, MIME type and byte count.

Digital customer preview is a presentation preview. Previewing an already uploaded private PDF or other digital asset as an author requires a backend-authorized access endpoint; the app does not construct public storage URLs or bypass purchase access.

## Preview rules

- Save curriculum changes before expecting them in training preview. Saved drafts can be previewed without publication.
- Filter at both module and material level when drafts are excluded.
- Author preview uses the author access endpoint, including draft files. Purchased lesson access continues to use the learner endpoint.
- Preview completion never calls the learner progress endpoint.
- Digital preview reads the current form, including unsaved edits, and never performs product, publication or checkout mutations.

## Validation

Focused tests cover unsafe YouTube URLs, native application identity, signed URL preservation, access rejection, expiration/refresh, background player removal, native control configuration, saved draft filtering, local preview progress, metadata normalization, failed replacements and allowed-fields-only saves.

Before release, test a native build on iOS and Android with an embedding-enabled YouTube video and a supported uploaded MP4. Verify fullscreen, rotation, close/back, background/resume, expired links, denied access, failed replacement uploads, both languages and reopening a saved draft. Browser playback checks do not establish native WebView or native codec behavior.
