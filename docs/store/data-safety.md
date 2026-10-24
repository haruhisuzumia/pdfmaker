# Play Console answers: Panna

## Data safety
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (nothing is collected). Drive uploads go over HTTPS directly to the user's own Google Drive. |
| Do you provide a way for users to request that their data is deleted? | Not applicable (nothing is collected). Users can delete their documents in the app, and disconnect Drive in Settings. |

**Why "No":** Play treats data as *collected* only when it's sent off the device to the developer or a third party. Panna has no server. Files the user chooses to back up go to **their own** Google Drive with their consent, which Play counts as user-initiated transfer to a service the user controls. ML Kit runs on the device.

## App content
| Section | Answer |
|---|---|
| Privacy policy | https://haruhisuzumia.github.io/pdfmaker/privacy-policy.html |
| Ads | No ads |
| App access | All functionality is available without special access (Google Drive is optional) |
| Content rating | Questionnaire: Utility / Productivity, no objectionable content → **Everyone / 3+** |
| Target audience | 18+ (avoids Families policy requirements; the app is for adults handling paperwork) |
| News app | No |
| Government app | No (helps with government forms but isn't affiliated with any government) |
| Financial features | None |
| Health | None |

## Permissions in the release build
Only `INTERNET` (Google Drive backup). Camera, gallery, audio and storage permissions are explicitly removed in `app.json` (`android.blockedPermissions`).
