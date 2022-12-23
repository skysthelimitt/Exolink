const express = require('express');
const app = express();
const axios = require('axios').default;
const puppeteer = require('puppeteer');
const ejs = require('ejs');
require('dotenv').config();

app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');

app.get('/', (req,res) => {
    console.log('Homepage request received')
    res.render('index')
})

app.post('/getData', (req, res) => {
    console.log('/getData request received');
    (async () => {
        try {
            // server-side validation and correction
            var shortLink = req.body.link

            if(shortLink.startsWith('http://')) { shortLink = shortLink.substring(7) }
            else if (shortLink.startsWith('https://')) { shortLink = shortLink.substring(8) }
            if (shortLink.startsWith('preview.page.link/')) shortLink = shortLink.substring(18)
            if (shortLink.startsWith('exoracer.page.link/')) shortLink = shortLink.substring(19)

            let additionalCharacter;
            if (shortLink.indexOf('?') > -1) {
                additionalCharacter = '&'
            } else {
                additionalCharacter = '?'
                switch (shortLink.length) {
                    case 4:
                        break;
                    case 17:
                        break;
                    default:
                        res.json({
                            "status": "ERROR",
                            "error": "Validation error: Short links must be either 4 or 17 characters"
                        });
                        return;
                        break;
                }
            }

            // actually doing the thing
            console.log(`Loading flowchart for exoracer.page.link/${shortLink}`)
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            
            await page.goto(`https://exoracer.page.link/${shortLink}${additionalCharacter}d=1`, {
                waitUntil: 'networkidle0'
            });
            
            const link = await page.evaluate(() => {
                return document.getElementsByTagName('a')[0].href.baseVal;
            });
            if (link) { 
                console.log('Long dynamic link found'); 
            } else {
                console.log('Long dynamic link not found');
                res.json({
                    "status": "ERROR",
                    "error": "Long dynamic link couldn't be found - does your short link exist?"
                });
                await browser.close();
                return
            }
            
            await browser.close();

            let levelId = link.substring(link.indexOf('levelId%3D')).substring(10, 46);
            let title = decodeURIComponent(link).substring(decodeURIComponent(link).indexOf('?title=')).substring(7).split('&')[0].replaceAll('+', ' ')
            let description = decodeURIComponent(link).substring(decodeURIComponent(link).indexOf('&description=')).substring(13).split('&')[0].replaceAll('+', ' ')
            // let title = link.substring(link.indexOf('&st=')).substring(4).split('&')[0].replaceAll('+', ' ')
            // let description = link.substring(link.indexOf('&sd=')).substring(4).split('&')[0].replaceAll('+', ' ')
            let levelVersion = decodeURIComponent(link).substring(decodeURIComponent(link).indexOf('&levelVersion=')).substring(14).split('&')[0]

            res.json({
                "status": "SUCCESS",
                "title": title,
                "description": description,
                "levelID": levelId,
                "levelVersion": levelVersion
            })
        } catch (error) {
            console.log(error)
            res.json({
                "status": "ERROR",
                "error": `${error}`
            })
        }
    })();
});

app.post('/makeLink', (req, res) => {
    console.log('/makeLink request received');
    (async () => {
        try {
            // server-side validation + variables
            let title = req.body.title;
            let description = req.body.description;
            let levelId = req.body.levelID;
            let levelVersion = parseInt(req.body.levelVersion);

            let levelIDregex = /^[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]-[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]-[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]-[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]-[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]$/
            if (!(levelIDregex.test(levelId))) {
                res.json({
                    "status": "ERROR",
                    "error": "Validation error: Invalid level ID"
                });
                return
            }

            // actually doing the thing
            console.log('Making request to create link')
            await axios.post(`https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${process.env.LINK_KEY}`, {
                "longDynamicLink": `https://exoracer.page.link:443/?ibi=com.nyanstudio.exoracer&link=https%3a%2f%2fexoracer.io%2f%3flink%3dLEVEL%26levelId%3d${levelId}%26levelVersion%3d${levelVersion}&si=https%3a%2f%2fstorage.googleapis.com%2fexoracer-bd008.appspot.com%2flevels%2f${levelId}-1.png&sd=${encodeURI(description).replace('%20', '+')}&amv=0&st=${encodeURI(title).replace('%20', '+')}&apn=com.nyanstudio.exoracer&ofl=https%3a%2f%2fexoracer.io%2fdeeplinkfallback.php%3ftitle%3d${encodeURI(title).replace('%20', '%2b')}%26description%3d${encodeURI(description).replace('%20', '%2b')}%26imageUrl%3dhttps%253a%252f%252fstorage.googleapis.com%252fexoracer-bd008.appspot.com%252flevels%252f${levelId}-${levelVersion}.png`,
                "suffix": {
                    "option": "UNGUESSABLE"
                }
            })
            .then((response) => {
                console.log(`Link created: ${response.data.shortLink}`)
                res.json({
                    "status": "SUCCESS",
                    "link":`${response.data.shortLink}`
                })
            })
            .catch((error) => {
                console.log(error.message)
                res.json({
                    "status": "ERROR",
                    "error": `${error.message}`
                })  
            })
        } catch (error) {
            console.log(error)
            res.json({
                "status": "ERROR",
                "error": `${error}`
            })  
        }
    })();
})

app.listen('8080', () => {});