# UpdatingText

To better support multiple languages we have stored the text for each page in JSON file: en.json for english es.json for Spanish ect.
The index.html has a line:  data-lang-key="menu.selectAvatar " > Select Your Character 
but the real text that displays for that menu item will depend on the language that the user has selected.

When adding new text, you will need to update each of the language files. This solution does not scale well.  Currently we have files for the top 5 languages the museum identified.
js/i18n.js will use the json files and add the appropriate text based on data-lang-key values.

js/render.js will render the pages.


# WesternHeritage
 Issues discussed:  
 1) How will device be used.  Should games be seperate apps or all in one app?
 2) Handling of adding new questions.  Limitations of Switching Languages (menu text only, avatar still speaks English).  Is it still worth having the questions translated to other languages if the ansers are all in English.
 3) Handoff of this work once done.  Can someone from the museum create a GitHub account and be added as a collaborator to this repository)
 4) We will look into the use of A.I. with the Proto to determine the feasibility


A prototype of possible HTML menu system with Proto Luma videos playing in the background.
Right now the video play is laggy, so I just have placeholder images.

This GitHub page is hosting the website:  ***https://heathermarriott.github.io/WesternHeritage/***

# See Videos, Playlists, Apps on the Device
***https://cloud.protohologram.com/login*** cowboycrucibles@outlook.com

# To do:
1) Figure out how to run locally (bring ethernet cable)
2) Make radio buttons bigger
3) Heather - expand on game selection
4) Heather - create more questions




# Older Notes: 
1) ~~run video on local machine to reduce lag (preload videos?)~~
2) ~~full language support for html text as shown in languages.html~~
3) ~~check with Project Sponsors before proceeding much further with this model~~ - Doug and Dennis love the mockup :) 

To test the website:
python3 -m http.server 8000  
then access with access with http://localhost:8000/

Proto Luma Website Dimensions: 2160 x 3840   9x16 aspect ratio

ChatGPT generated graphics for: cowboy hat, horse, and 2 placeholder avatars

We can test this on the proto device using: ***http://protoapps.protohologram.com***

To convert to webm: ffmpeg -i .\input.mp4 -c:v libvpx-vp9 -b:v 8M -vf "scale=2160:3840" -c:a libopus -b:a 320k -ar 48000 -ac 2 .\output.webm
