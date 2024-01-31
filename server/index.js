// Import necessary modules
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const csv = require('@fast-csv/format');
const { parse, parseFile } = require('@fast-csv/parse');
const pkg = require('pg');
const pgvector = require('pgvector/pg');
const { LocalIndex } = require('vectra');

let index = null;
if (process.env.MODE == "vectra") {
    console.log('running vectra', process.env.MODE)
    index = new LocalIndex(path.join(__dirname, 'index'));
}

class CsvFile {
    static write(filestream, rows, options) {
        return new Promise((resolve, reject) => {
            csv.writeToStream(filestream, rows, options)
                .on('error', err => reject(err))
                .on('finish', () => { console.log('Write finished'); resolve() });
        });
    }

    read(options, row_formatter) {
        return new Promise((resolve, reject) => {
            const data = [];
            parseFile(this.path, options)
                .on("error", reject)
                .on("data", (row) => {
                    const obj = row_formatter(row);
                    if (obj) data.push(obj);
                })
                .on("end", () => {
                    resolve(data);
                });
        });
    }

    constructor(opts) {
        this.headers = opts.headers;
        this.path = opts.path;
        this.writeOpts = { headers: this.headers, includeEndRowDelimiter: true };
    }

    create(rows) {
        return CsvFile.write(fs.createWriteStream(this.path), rows, { ...this.writeOpts });
    }

    append(rows) {
        return CsvFile.write(fs.createWriteStream(this.path, { flags: 'a' }), rows, {
            ...this.writeOpts,
            // dont write the headers when appending
            writeHeaders: false,
        });
    }
}

// Define sample data
const csv_path = 'animes.csv';
const api_key = process.env.API_KEY;
const { Client } = pkg
const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
})
const source_data = [
    {
        "title": "Cowboy Bebop",
        "description_small": "The futuristic misadventures and tragedies of an easygoing bounty hunter and his partners.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Simply the greatest for an outstanding cast of characters, triumphant soundtrack, spectacular action, and it can be watched either dubbed or subbed, both versions are sublime.Despite initially being episodic in nature underlying storyline rears its head and proves to thoroughly engaging, you've just got to give this anime the opening five episodes, don't make a judgement call after just one episode. See it out and you will be greatly rewarded."
    },
    {
        "title": "Steins;Gate",
        "description_small": "After discovering time travel, a university student and his colleagues must use their knowledge of it to stop an evil organization and their diabolical plans.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "One of the greatest all round anime ever. With comedy, romance, tragedy, sci-fi, and even a little action blended perfectly together. It featured an original premise and a satisfying conclusion.The character of Mad Scientist will become one of your favourites.Since it involves time travel the first episode is seriously confusing, however by the end of episode three you'll be fully clued in, essential viewing, don't drop it! The best time travel anime ever made."
    },
    {
        "title": "Rurouni Kenshin: Trust and Betrayal",
        "description_small": "In the era of Japan's Meiji Restoration, an assassin regains his humanity.",
        "genere": "Animation, Action, Adventure",
        "description_big": "The 4 episode OVA prequel to the original Kenshin anime. This anime involves masterful storytelling, Kenshin the main character is given a rich backstory, the anime plays out always rising, never falters, zero filler, a rich and rewarding experience. The greatest samurai anime ever made.Despite only being four episodes long it feels very complete and those who want to see more of Kenshin (which you will) can check out the sequel (original anime) series."
    },
    {
        "title": "Berserk",
        "description_small": "Guts, a wandering mercenary, joins the Band of the Hawk after being defeated in a duel by Griffith, the group's leader and founder. Together, they dominate every battle, but something menacing lurks in the shadows.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This series has perhaps the greatest character development of any anime ever made, you become attached to each character who each has well fleshed out personalities comprised of individual qualities, flaws, and ideals. If you hold merit for engaging plot, are exhilarated by action scenes with large doses of violence and don't abhor nudity this is definitely the anime series for you. It's one of the best anime I've ever seen, the only thing that holds it back as an anime series is one tedious flaw, you'll have to watch it, to find out for yourself."
    },
    {
        "title": "Baccano!",
        "description_small": "A crazy fantasy caper involving alchemists, immortals, gangsters, outlaws and an elixir of immortality, spread over several decades.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This anime initially can be confusing because of the huge, overwhelming cast of characters but persevere! It’s a series that’s hard to describe without spoiling it. If you like hardcore action, suspense, and fantasy. You will love it. Issac and Miria are my favourite anime duo ever! However Baccano! does feature some demented characters and plenty of graphic violence. If you like Elfen Lied you will adore Baccano! P.S. The team that made this later went onto make Durarara!! which was just a modern set, watered down, rehash of Baccano! Basically if you watched Durarara!! and haven't seen this you should look in a mirror and slap yourself :P (This anime requires a minimum trial period of five episodes)."
    },
    {
        "title": "Mushi-Shi",
        "description_small": "Ginko is an expert travelling around to investigate a primeval life-form, the \"Mushi,\" and helping people with Mushi-related supernatural problems.",
        "genere": "Animation, Drama, Fantasy",
        "description_big": "Ask people for the most beautiful anime ever made and the vast majority will reply, Mushi-Shi. It's unique in the fact that the entire anime centers almost entirely on one character. The scenery is beautiful, however this is an episodic anime, if you need an anime that continues on from week to week this may not be for you.Without spoiling anything about the story I'll just say this is an anime to be savoured, perhaps one episode each night. The most magical, relaxing anime I've ever seen. Simply wonderful."
    },
    {
        "title": "The Rose of Versailles",
        "description_small": "The story of Lady Oscar, a female military commander who served during the time of the French Revolution.",
        "genere": "Animation, Action, Drama",
        "description_big": "This is a fascinating telling of Queen Marie Antoinette's rise and fall as ruler of France.This anime involved murder, suicide, betrayal, cross dressing and even a rape attempt. It was utterly groundbreaking and still is, the cover art is totally unfitting with the mature and serious nature of this anime.It's a high drama/romance/history anime.... it actually centers on a character called Lady Oscar, I almost dropped it during the early episodes but didn't and I was greatly rewarded, it has one of the best anime endings ever. It does take awhile to really take off and grip you however it's well worth the wait. It's an anime for those interested in a brilliant plot and exceptional character development."
    },
    {
        "title": "Legend of the Galactic Heroes",
        "description_small": "Various people, especially two rising commanders, cope with a massive continual space conflict between two interstellar nations.",
        "genere": "Animation, Action, Drama",
        "description_big": "This anime takes some 25 of its total 110 episodes to really grasp the viewer, however those with patience are treated to arguably the greatest anime ever made.I seriously don't want to spoil anything about this masterpiece of an anime, I'll just say this is one if not thee best space opera anime ever made.Are you tired of stagnant and hollow characters? Are you tired of pointless fanservice? Are you tired of watching anime with no content or appeal for the intellectual viewer? If the answer to these questions is yes, you must watch this anime. You won't be disappointed."
    },
    {
        "title": "Now and Then, Here and There",
        "description_small": "A young boy named Shuzo rushes to the defense of a stranger who is being attacked for her magic pendant, only to find himself transported into another world where water is a scarce commodity and he is forced to join an army of children.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Wow, just wow. It dropped my jaw the first time I watched it, as a guy I normally like war movies, shows, anime however they usually glamorise war. This anime is the exact opposite, I did really love it but because it had a magnificent, strong anti-war message.I won't say much as I don't want to spoil anything but this is a very short anime and certainly worthwhile viewing."
    },
    {
        "title": "Hunter x Hunter",
        "description_small": "Gon Freecss aspires to become a Hunter, an exceptional being capable of greatness. With his friends and his potential, he seeks out his father, who left him when he was younger.",
        "genere": "Animation, Action, Adventure",
        "description_big": "I previously had the 90s incarnation of Hunter x Hunter on this list. While both are almost identical in dialogue and scene by scene, I've switched in this newer version as it's what the vast majority of watchers have placed their valuable viewing time towards. While both versions are hugely recommendable, this version is more complete into one bundle. With the original Hunter x Hunter being split over a series and multiple OVA's.Anyway it's a fantastic anime and one that genuinely can be considered a staple for the genre."
    },
    {
        "title": "Bunny Drop",
        "description_small": "A man adopts his six-year-old aunt and raises her as his own kid.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Just an incredibly sweet and touching story of a man trying to raise a young child single-handedly. This anime was such a breath of fresh air to the medium, completely out of the norm and perhaps all the more enjoyable for that fact.It features a slightly unique art style that a casual anime viewer will not be accustomed to but by the second episode you will have adjusted. It's a very short anime but exceptionally good."
    },
    {
        "title": "Rurouni Kenshin",
        "description_small": "The adventures of a young wandering swordsman who stumbles upon a struggling martial arts school in Meiji era Japan.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Everything that needs to be said about this anime has already been said and is known to pretty much every anime viewer. If you've never seen an anime then Rurouni Kenshin is a good place to start.It's a quality all rounder, it has action, comedy, romance... there's enough there to keep everybody entertained.It has a solid story and is well executed, the cast of characters are extremely likable. Perhaps the greatest strength of this series is that it doesn't have any glaring flaws."
    },
    {
        "title": "Monster",
        "description_small": "Dr. Kenzo Tenma, an elite neurosurgeon, finds his life in utter turmoil after following his conscience to operate on a small boy named Johan.",
        "genere": "Animation, Crime, Drama",
        "description_big": "No question Monster deserves to be on this list. A real question would be, why hasn't Monster placed higher? Perhaps because this truly is a love or hate anime. While I really enjoyed it, I know a lot of people whose opinion I respect that offered well reasoned arguments for not particularly holding fondness for this anime.I would say this is arguably the greatest thriller anime ever made, it's so tense and suspenseful in scenes. It has a brilliant story, shame that it's a slow burner and that many people drop it before it gets good. Putting some filler eps aside and the fact it takes 20+ episodes to really draw you in, don't drop this! It's definitely a worthwhile watch."
    },
    {
        "title": "Gyakkyô burai Kaiji",
        "description_small": "A young japanese man finds himself in a strange game to recover from his debts.",
        "genere": "Animation, Action, Thriller",
        "description_big": "This anime has a refreshingly unique and compelling story. Without spoiling too much it's about a character that gets into debt and has to try and gamble his way out. Maybe I'm not selling it enough but I really can't say a whole lot or I'll ruin the story, it does have a very interesting concept. The worst thing about this anime is the art style, casual viewers may not be able to cope with this. For those who manage with the art there is a great story. Highly recommended to fans of Akagi and One Outs."
    },
    {
        "title": "Maison Ikkoku",
        "description_small": "The misadventures of a young student and his landlady's romance.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Maison Ikkoku is the finest romance anime ever made, in terms of story structure, character development and emotional depth. If you look over this because it's of older animation then you really don't know what an incredible experience you've missed out on. Yes at 96 episodes it is long for the genre. However the story spans several years and this allows for real character and relationship progression.It is one of the funniest and most charming anime I've ever seen. It managed to turn a big time action and science fiction fan like me into a believer that there is great romance series out there. This remains the finest example of a believable romance story in anime. Do not miss it.P.S. This anime continually gets better as it progresses, the final 15 episodes of this anime are greater than any other romantic/comedy ever made. It delivers the most spectacular ending that you could possibly want in a rom/com. See this one out, enjoy the ride and I guarantee this will become a firm favourite of yours."
    },
    {
        "title": "Vinland Saga",
        "description_small": "Thorfinn pursues a journey with his father's killer in order to take revenge and end his life in a duel as an honorable warrior and pay his father an homage.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Vinland Saga was a breath of fresh air with its different setting, decent production values and surprising solidity. It features some good action scenes, steady build up, and adequate world building. Anyone looking for a decent action anime with a Viking theme should give this a go. While complaints can be put forth towards the MC Thorfinn none can for Askeladd who is perhaps the best anime character in the last 10 years."
    },
    {
        "title": "Lupin the Third",
        "description_small": "The adventures of the master thief Lupin III and his cohorts as they dive into various escapades, all the while in pursuit by the tenacious Inspector Zenigata.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This is one of the most fun, charming and endearing series to ever grace anime. The character of Lupin is one of the most magnificent and memorable in the medium, he's a terrific hero despite the fact he's a thief. Lupin is the source that inspired such characters as Spike from Cowboy Bebop.Lupin is the epitomy of cool that we all strive for. Good crime anime is hard to come by and this is the best as we watch the remarkable exploits of Lupin and his gang. I must also mention that greats of anime Hayao Miyazaki and Isao Takahata both worked on this series. It's not just a significant series in anime history, it's also incredibly entertaining."
    },
    {
        "title": "Death Note",
        "description_small": "An intelligent high school student goes on a secret crusade to eliminate criminals from the world after discovering a notebook capable of killing anyone whose name is written into it.",
        "genere": "Animation, Crime, Drama",
        "description_big": "I finally settled on where to place this anime, most of you will be wondering why so low? I can't go into elaborate details as I don't want to spoil anything for people who haven't watched this yet.So what are Death Note's good points? It's often gripping and thrilling. However when most people remember Death Note they tend to judge it on its early stages, ignoring all the flaws throughout. Lets just say after a certain character left this series and was replaced with two mediocre characters, the show went greatly downhill. Well that's my view anyway.However I can't deny the popularity and success of this series, the first 2/3's in my opinion are by far its best. It's a quality suspense/thriller and in my opinion worthwhile viewing. If you haven't seen it you must be living under a rock, check it out and see what the fuss is about."
    },
    {
        "title": "The Irresponsible Captain Tylor",
        "description_small": "The adventures of a space navy captain who is either an incredibly lucky idiot, or an unorthodox genius in tactics.",
        "genere": "Animation, Adventure, Comedy",
        "description_big": "This anime better known as Irresponsible Captain Tylor is the funniest Sci-Fi anime ever created. Lovable rogue Tylor is nothing short of a hilarious goof who stumbles through life with what must be said, a lot of incredible luck. If you're a fan of sudden girlfriend anime then look no further. Just watch the first episode of this, I guarantee you will be in stitches and instantly hooked. It's a series that once you start it, you have to finish it. It's 26 episodes of sheer brilliance."
    },
    {
        "title": "Ghost in the Shell: Stand Alone Complex",
        "description_small": "The futuristic adventures of a female cyborg counter intelligence agent and her support team.",
        "genere": "Animation, Action, Crime",
        "description_big": "This series came about due to the success of the 1995 movie Ghost In The Shell. The anime tv series deviates in feel to the original movie, it doesn't quite have the same dark tone, however it's a great watch in its own right. This anime has exceptional production values, a strong soundtrack but its greatest appeal is its premise. The philosophical questions it raises, ethical debates, realistic action and plausible futuristic setting make this a must see in my opinion.Certainly not for everyone, an intelligent anime for those who appreciate that sort of show.P.S. The Wachoswski brothers who created The Matrix movies have largely credited the 1995 Ghost In The Shell movie as their inspiration."
    },
    {
        "title": "Great Teacher Onizuka",
        "description_small": "About Eikichi Onizuka, a 22-year-old ex-gangster member and a virgin. He has one ambition that no one ever expected from him. His sole life purpose is to become the greatest high school teacher ever.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Certainly not for younger viewers. GTO is simply hilarious, silly comedy. It's aimed at older males but if you're in good form and don't take it too seriously you will wind up having a great time. It's got some great moral lessons and anyone who enjoys ridiculous antics and highly eccentric characters should give this a go, this anime does exactly what it says on the tin... it entertains. ”"
    },
    {
        "title": "Tomorrow's Joe",
        "description_small": "Joe, a teenage orphan living in the slums of the Doya streets, meets Danpei, a homeless alcoholic and former boxing trainer. Danpei, seeing Joe's talent for boxing, decides to train him.",
        "genere": "Animation, Action, Drama",
        "description_big": "Ashita no Joe is the perfect example of how when a simple story is told well, it can achieve greatness. On the surface it might not sound that special, a teenage orphan called Joe who is living in the slums, is convinced to take up boxing by an alcoholic ex-boxing coach. It's how it's handled that makes it special, due to the masterful touch of legendary director Osamu Dezaki, Ashita no Joe is a fantastic example of brilliant story telling and memorable characters. It's an older series and the animation might be a burden for a lot of people but it's well worth making an exception for this one and watching both seasons of it through. It's one of those anime that when you finish it, you're left with a feeling of loss, a feeling of devastation that there's no more episodes."
    },
    {
        "title": "One Punch Man",
        "description_small": "The story of Saitama, a hero that does it just for fun & can defeat his enemies with a single punch.",
        "genere": "Animation, Action, Comedy",
        "description_big": "One of the most popular anime ever. The disinterested hero who saves the day, for some reason people go nuts for this trait. Our hero like the name suggests is so powerful he defeats every monster with a single punch. While I don't love it as much as most do, it's watchable particularly considering the small number of episodes.The biggest charm of the series is the unusual premise and comedic elements. The biggest flaw of this series is the second season, production values dropped and the novelty and charm of the first season diminished. Recommended to those looking for an Action/Comedy that does not require a big time investment."
    },
    {
        "title": "Code Geass",
        "description_small": "After being given a mysterious power to control others, an outcast prince becomes the masked leader of the rebellion against an all-powerful empire.",
        "genere": "Animation, Action, Drama",
        "description_big": "Code Geass = quality character development, sufficient story progression, adequate animation, some interesting questions surrounding morality and some entertaining action scenes.CG is often compared to Death Note for its \"intellectual intrigue\" however I'm not so sure how strong a case can be made for that. Comparisons between Light from DN and Lelouch from CG are justified though."
    },
    {
        "title": "Romeo and the Black Brothers",
        "description_small": "The adventures of a young Swiss boy working as a chimney sweeper in Milan.",
        "genere": "Animation, Adventure, Drama",
        "description_big": "Romeo no Aoi Sora= Another drama anime that many might find themselves sobbing at, a story about a brave boy who sells himself as a chimney sweep to pay for a doctor for his father. It's a slow paced triumph of drama, friendship, heartache, hardships and character. Few anime have heart like this. Recommended to fans of Clannad and Ie Naki Ko."
    },
    {
        "title": "Black Lagoon",
        "description_small": "A Japanese businessman, captured by modern-day pirates, is written off and left for dead by his company. Tired of the corporate life, he opts to stick with the mercenaries that kidnapped him, becoming part of their gang.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Simply the greatest straight up action anime ever made! There is no tricks, no fantasy elements, just great action.Revy the main character is the most badass anime chick to ever live. She owns all the so called badass chicks of anime and most of the guys for that matter :PRevy = A dual pistol wielding, cigar smoking, foul mouthed, whiskey drinking, cold hearted killer."
    },
    {
        "title": "Darker Than Black",
        "description_small": "In Tokyo, an impenetrable field known as \"Hell's Gate\" appeared ten years ago. At the same time, psychics who wield paranormal powers at the cost of their conscience also emerged. Hei is ...                See full summary »",
        "genere": "Animation, Action, Drama",
        "description_big": "How can an anime with so many flaws make this list? There's a few anime on this list that would fall under that question, DTB is certainly one of them. Why you ask?It's one of those anime that just dives right in and is very confusing at the beginning. Not to mention that it takes time to become emotionally invested in the characters.However when DTB gets good, it's very good. A well directed anime with, superpowers, suspense, mystery and an interesting anti-hero character. Definitely for fans of Death Note and Code Geass."
    },
    {
        "title": "Ranma ½",
        "description_small": "A girl is involuntarily engaged to a boy who turns female when hit with cold water and male when hit with hot.",
        "genere": "Animation, Action, Comedy",
        "description_big": "One of the four Rumiko Takahashi anime on this list (the other three being Maison Ikkoku, Inuyasha and Urusei Yatsura). Ranma 1/2 is probably the most fun of all of them. A ridiculous and silly concept means that this anime provides a lot of side hurting laughs during its run.A fun cast of characters, some very memorable moments and it's arguably the most amusing anime on this list. This anime is a sure thing if you're looking for a pleasant watch."
    },
    {
        "title": "Neon Genesis Evangelion",
        "description_small": "A teenage boy finds himself recruited as a member of an elite team of pilots by his father.",
        "genere": "Animation, Action, Drama",
        "description_big": "The anime that arguably cemented the mediums legitimacy and sky rocketed its popularity in America and most of the western world. Neon Genesis Evagelion while starting out rather simplistic quickly develops into a roller coaster ride of epic and profound proportions.Words can't describe this anime adequately, I will simply say I can see why NGA is held in such high esteem and for the most part I think it deserves the iconic status it holds."
    },
    {
        "title": "Moribito: Guardian of the Spirit",
        "description_small": "The Second Empress hires a spear-wielding woman to save her son from the Mikado (emperor) who believes the young prince is possessed by a water demon foretold to bring a terrible drought upon the land should he live.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Comparisons with 12 Kokuki (The Twelve Kingdoms, which features later on this list) are inevitable when it comes to this anime. Perhaps it's a little simplistic but Guardian of the Sacred Spirit remains a fantastic adventure/fantasy anime. Did you like Rurouni Kenshin? Did you like Claymore? Did you like any of the Studio Ghibli films? If you answered yes to any of these go watch this anime now. It's a well done character driven anime with some highly impressive action scenes."
    },
    {
        "title": "Gungrave",
        "description_small": "Gungrave follows the story of best friends Brandon Heat and Harry MacDowell as they join and rise in the ranks of Big Daddy's Millenion crime syndicate. The story begins in the future ...                See full summary »",
        "genere": "Animation, Action, Crime",
        "description_big": "Gungrave = A fantasy version of Scarface. That pretty much captures its essence. Gungrave is made by the same creator who made Trigun... and in my opinion this anime is the better of the two. Trigun is hugely flawed as an anime and its only real redeemer was some great comedy and a brilliant character in Vash, perhaps where Gungrave surpasses its predecessor is in the brilliance of its ending.While both have weak episodes I felt Trigun had more and I was bitterly disappointed with its ending.Recommended to those who liked Trigun, this is an action packed, quality anime. Just don't drop it on a whim."
    },
    {
        "title": "Gurren Lagann",
        "description_small": "Two friends, Simon and Kamina, become the symbols of rebellion against the powerful Spiral King, who forced mankind into subterranean villages.",
        "genere": "Animation, Action, Adventure",
        "description_big": "TTGL damn near impossible to describe. Off the scale action, sheer absurdity. This is an anime where characters dream and reach to do the impossible, off the chart levels of epicness, realism holds no merit here. This sums it up....\"I knew a man who once said death smiles at us all, all a man can do is smile back\". *pats self on back for managing to work in a relevant Gladiator quote that can be applied to this anime* XD"
    },
    {
        "title": "Claymore",
        "description_small": "In a world plagued by deadly creatures called \"youma,\" a young silver-eyed girl, Clare, works on behalf of an organization that trains female youma half-breeds to become warriors.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Perhaps I'm a little sexist in saying this but Kureimoa aka Claymore is more of a guys anime. It's an action/adventure/fantasy anime. Perhaps an effort was made to bring in a larger female audience by casting a female lead in Clare....... however this anime is hugely comparable to Berserk in terms of feel and hack and slash action. Berserk was probably the tad darker of the two. Either way highly recommended to fans of the action/fantasy genre."
    },
    {
        "title": "Fullmetal Alchemist",
        "description_small": "When a failed alchemical ritual leaves brothers Edward and Alphonse Elric with severely damaged bodies, they begin searching for the one thing that can save them: the fabled philosopher's stone.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Oh come on..... you need some info on this? Really?Honestly this is one of the most well known anime ever made, anybody seriously interested in anime should be checking this one out.P.S. There's a remake called Fullmetal Alchemist Brotherhood, I've gone with this one for reasons that would take eons of time to explain."
    },
    {
        "title": "Charcoal Feather Federation",
        "description_small": "A young girl is reborn as an angel-like creature called a haibane, with no memory of who she once was.",
        "genere": "Animation, Drama, Fantasy",
        "description_big": "A really curious anime, it's not easy to decipher what it's actually about, I believe that it is one of those anime that encourages discussion about the meaning of life.It does raise some really fascinating questions about death and what comes after, it's executed in a slow paced style. I'd recommend this anime to fans of Mushi-shi."
    },
    {
        "title": "Demon Slayer: Kimetsu no Yaiba",
        "description_small": "A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly. Tanjiro sets out to become a demon slayer to avenge his family and cure his sister.",
        "genere": "Animation, Action, Adventure",
        "description_big": "The biggest anime hit of the last few years. We've been here before as every few years the industry churns out something that becomes so popular even people with only a passing interest in anime hear of them, indeed \"Attack on Titan\", \"Sword Art Online\", \"One Punch Man\" might be considered previous examples of the trend.The problem with these series is that due to high expectations they often wind up disappointing.Kimetsu is nothing groundbreaking, nothing we have not seen a thousand times before however due to the slow fleshing out of the characters and story the potential for it to be something special remain.The story in short is about a boy setting out to fight demons in order to find a cure for his sister who has been turned. It's an all rounder with some comedy, action, adventure. It would make for a good starter anime for people new to the medium."
    },
    {
        "title": "Serial Experiments Lain",
        "description_small": "Strange things start happening when a withdrawn girl named Lain becomes obsessed with an interconnected virtual realm known as \"The Wired\".",
        "genere": "Animation, Drama, Horror",
        "description_big": "Serial Experiments Lain= Let me start off with the positive aspects of the series. The music for its opening theme is nothing short of haunting, it washes over you like a lucid dream. The concept of this anime is brilliant as it aims to raise philosophical questions about our existence.We are our mind if anything, our bodies hold us back in some respects. If could imprint yourself, your mind into the internet “The Wired” would you do it? So that’s the positive aspects.Where Serial Experiments Lain fails sometimes is in the execution of the premise. It’s a little convoluted and as the series progresses the message deteriorates to a small degree. The concept and philosophical questions this anime tries to raise in essence the blending of man and technology, are much better realised in an anime like Ghost In The Shell: Stand Alone Complex. However this is still a decent and interesting series definitely worth checking out."
    },
    {
        "title": "Eureka Seven",
        "description_small": "14-year-old Renton joins the rebel GekkoState ship, co-pilots the TypeZero with the mysterious Eureka, and unknowingly becomes part of a grand scheme.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Eureka 7 = one of the better mecha anime. A satisfying blend of drama, sci-fi and romance. Certainly one those anime that falls under the genre of \"must see\", it's a solid series and you won't regret watching this."
    },
    {
        "title": "Death Parade",
        "description_small": "After death, humans go to either heaven or hell. But for some, at the instant of their death, they arrive at the Quindecim, a bar attended by the mysterious white-haired Decim.",
        "genere": "Animation, Drama, Mystery",
        "description_big": "Death Parade was a fascinating anime in recent times. It focused on judging the true nature of people through a series of tests and games. There's no linear story really, the biggest strength of the series is the premise as most episodes are standalones. However thanks to some fine execution this anime was definitely more hit than miss. Recommended to those looking for something a bit different."
    },
    {
        "title": "Super Dimension Fortress Macross",
        "description_small": "An alien spaceship crash lands on Earth and her secrets lead to a desperate war against an alien enemy sent to retrieve the ship.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Don't let that cover art fool you, Macross was a very well animated series for its time. It's the most famous mecha series ever made, the one that pretty much defined the genre and in my opinion still does.In my honest opinion it's every bit the equal of Mobile Suit Gundam, I enjoyed both but I've placed Macross higher because I feel it will appeal to a wider audience. I highly recommend this anime.P.S. Be sure to watch this version and not the god awful Robotech version, honestly the dubbing and changes they made to the story was horrendous. Watch the original 1982 subtitled version."
    },
    {
        "title": "Spice and Wolf",
        "description_small": "Kraft Lawrence goes from town to town to make profits as a travelling merchant, with the help of a wolf deity by the name of Holo.",
        "genere": "Animation, Adventure, Drama",
        "description_big": "This is an extremely dialogue heavy anime. While certainly not for everyone because it's a story about merchant trading in medieval times, it's often a lesson on economics and for those interested in something different, this anime is worth watching.The interactions between the characters are arguably what makes this series special, it's an adventure/fantasy/romance anime, while favourable just be prepared for a lot of dialogue."
    },
    {
        "title": "Phantom: Requiem for the Phantom",
        "description_small": "The story of two brainwashed assassins, Ein and Zwei, who struggle to regain their memories as they work for the Inferno crime syndicate.",
        "genere": "Animation, Action, Crime",
        "description_big": "A solid anime, the opening episodes are very interesting. It's about a man who has the life of an assassin thrust upon him. It's very much action oriented but the story is well above average. I'd recommend this anime for big action fans or someone who wants an anime about assassins."
    },
    {
        "title": "Elfen Lied",
        "description_small": "Two university students come across a seemingly harmless girl named Lucy, unaware that she's actually a mutant serial killer with a split personality.",
        "genere": "Animation, Action, Drama",
        "description_big": "Elfen Lied = Extreme violence, high amounts of graphic gore, and a hot mutated chick that strolls around naked most of the time.That may be a bit simplistic but it's not too far from the truth. Elfen Lied has become huge in the medium of anime due to its obvious effort to shock and entertain, for the most part it succeeded in doing that.The first episode is often widely mentioned as the most violent single episode of any anime in the medium. Be sure to check this out, it's certainly not for kids though."
    },
    {
        "title": "School Rumble",
        "description_small": "A young high schooler is in love with an oblivious classmate; a delinquent classmate is in love with her. Both struggle to confess their feelings and their antics lead to crazy situations.",
        "genere": "Animation, Comedy, Romance",
        "description_big": "Ask the typical anime fan of today which comedy series is the best? The vast majority will reply School Rumble. I don't disagree with that opinion but personally anime like GTO: Great Teacher Onizuka, Ranma 1/2 and City Hunter appealed more to me.That said School Rumble is a great comedy but is stereotypically set in a school, with stereotypical characters. The reason School Rumble excels is that the comedy is generally very good. I consider School Rumble to be perhaps the greatest outright modern comedy, better than Toradora! The only reason that it's relatively low on the list was because season 2 wasn't as great as the first."
    },
    {
        "title": "Fighting Spirit",
        "description_small": "Ippo, a teenage boy with a pure heart and unrelenting determination, discovers a passion for boxing after veteran fighter Takamura saves him from bullies.",
        "genere": "Animation, Action, Comedy",
        "description_big": "Do you like boxing? If yes watch this.Do you like the Rocky movies? If yes then watch this.Do you like brilliant blending of action and comedy? If yes then watch this.My only complaint is that it's a slow starter, it's a real shame that many people drop it without giving it a fair chance. It really is their loss, they can continue watching stuff like School Days."
    },
    {
        "title": "Revolutionary Girl Utena",
        "description_small": "A tomboyish schoolgirl finds herself forced into repeated duels for another girl who has a role in a world revolution.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Revolutionary Girl Utena= If you were to take it on face value RGU doesn't seem like anything that special. However it quickly becomes obvious that Utena is a once off and that it's far deeper than meets the eye. It explores themes including homosexuality, I certainly didn't expect this from what I was lead to believe was a childrens anime. To tell the truth this anime caught me off guard a number of times, particularly in later episodes. It was nothing like I expected it to be, this was actually a plus. It's a fantasy, action, drama but it's a strange one and very bold. Whether you love or hate it, this is certainly memorable."
    },
    {
        "title": "Natsume's Book of Friends",
        "description_small": "When Natsume Takashi inherits a book that belonged to his late grandmother he realizes the book is filled with the names of spirits she defeated and bound to her will. He then decides to return their names so they can be free once again.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "An imitator of Mushishi. That may sound a little harsh but it's uncanny how close the basic plot and structure is to Mushishi. It's an episodic anime that deals with a male lead that can see entities that remain invisible to most people. The big difference is that Mushishi is slighly more artistic where we the viewer are asked to comtemplate various themes. Both are very good, if you enjoy one the odds are highly probable that you'll also like the other. This anime is highly recommended to fans of Mushishi."
    },
    {
        "title": "Inuyasha",
        "description_small": "A teenage girl periodically travels back in time to feudal Japan to help a young half-demon recover the shards of a jewel of great power.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This is another Rumiko Takahashi anime series. Funnily enough it's her most well known anime, perhaps because it's the most recent. Rumiko combined the elements that made brilliant anime like Maison Ikkoku (romance) and Ranma 1/2 (comedy) in Inuyasha. For the most part it worked. This is certainly a good watch despite being a little on the long side.P.S. Be sure to watch the continuation series to this, the 26 episode anime called Inuyasha: The Final Act (You sort of have to, as the original anime was left without an ending, \"The Final Act\" finally gave closure to the series)."
    },
    {
        "title": "The Twelve Kingdoms",
        "description_small": "High school student Youko Nakajima is approached by a strange man who claims he's been searching for her and that she is the rightful ruler of his kingdom.",
        "genere": "Animation, Adventure, Drama",
        "description_big": "Great story, great characters, a brilliant adventure. This is an anime many have tried to imitate but most have failed. It's an action/adventure/fantasy anime that few have equaled and even fewer have surpassed.Highly recommended to fans of the fantasy genre, if you're watching any ongoing fantasy anime or have enjoyed some recently then please consider watching this. The 12 Kingdoms is an immensely enjoyable journey."
    },
    {
        "title": "Kaiba",
        "description_small": "In a futuristic dystopian world where memories are literally stored, bought and sold and rich have all the privileges, a young amnesiac is trying to find out who he is.",
        "genere": "Animation, Adventure, Drama",
        "description_big": "This anime puts forth fascinating philosophical questions. It's a terrific series for its plot and well fleshed out sci-fi world. It's a unique love story set in a world where it's possible to store memories in databanks and transfer those memories to new bodies. This has made death irrelevant. However Kaiba uses an animation style that will put a lot of people off, for those of you who bear through that you'll be subject to a truly unforgettable anime. Highly recommended to experienced anime fans looking for something unique."
    },
    {
        "title": "The Vision of Escaflowne",
        "description_small": "Hitomi is a girl with psychic abilities who gets transported to the magical world of Gaea. She and her friends find themselves under attack from the evil Zaibach empire, and the Guymelf ...                See full summary »",
        "genere": "Animation, Action, Adventure",
        "description_big": "Escaflowne= This is a really well rounded anime, it has fantasy, mecha, romance and adventure. What's more it manages to do all these aspects well. The characters are well fleshed out overall and each gets enough screen time. My only complaints are with the slow early episodes and some slight issues with character design. This is a really solid anime and I wouldn't hesitate in recommending it to anyone."
    },
    {
        "title": "Yu Yu Hakusho: Ghost Files",
        "description_small": "After a teenage delinquent is killed while saving a child's life from an approaching car, the rulers of the underworld send him back to become an \"Underworld Detective\" investigating demons apparitions in the human world.",
        "genere": "Animation, Action, Adventure",
        "description_big": "A solid all rounder anime. There's comedy, action, mystery and fantasy. It's created by the same guy who wrote Hunter x Hunter, if you need further reason as to know why you should watch this...... it beat Dragon Ball Z in ratings during its tv run.I consider it a much better anime than DBZ and if you liked that you should definitely check out this one. Recommended highly to fans of Hunter X Hunter and Inuyasha."
    },
    {
        "title": "When They Cry",
        "description_small": "The story of a group of young friends and the mysterious events that occur in the rural village of Hinamizawa.",
        "genere": "Animation, Drama, Horror",
        "description_big": "Many people consider it the greatest horror of all time, it's certainly among the better examples in recent years. This show will make many tremble and a lot of you will be watching scenes through your hands. It was the mystery element that interested me, I had to know what was happening and where it was going. You'll have to watch the second season also to get the full picture, that's a total of 50 episodes. It certainly had something going for it to keep me interested for that length of time. Recommended to fans of Monster and those who enjoy suspense/horror."
    },
    {
        "title": "Durarara!!",
        "description_small": "Tired of his mundane life, Mikado Ryugamine decides to move to Ikebukuro, a district in Tokyo, when a friend invites him. With everything from invisible gangs to rumored beings, Ikebukuro is full of connected mysteries where people's pasts intertwine with the present.",
        "genere": "Animation, Action, Comedy",
        "description_big": "Look it's Baccano! oh wait, no it's the imitator of Baccano! The similarities between the two are plenty, it shouldn't come as a surprise as both anime were made largely be the same team. They took the elements that made Baccano! a success (mystery killer, large cast of characters, extreme violence) and rehashed them for this. If you love one the odds are you'll also love the other. The only huge difference is length and setting. While it's predecessor was original and had a great ending, the same can't be said for this work. However it is a quality anime, recommended to mystery/action fans."
    },
    {
        "title": "Mobile Suit Gundam",
        "description_small": "In the war between the Earth Federation and Zeon, a young and inexperienced crew find themselves on a new spaceship. Their best hope of making it through the conflict is the Gundam, a giant humanoid robot, and its gifted teenage pilot.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Mobile Suit Gundam= Where to begin on this series? It's arguably the most successful anime franchise ever, it has spawned countless prequels, sequels, ova's, movies etc. One thing that has become apparent is that the Japanese sure do love giant fighting robots :P Overall this will be a great anime for mecha fanatics and it's certainly worthwhile viewing to watch what kick started the whole Gundam phenonium."
    },
    {
        "title": "FLCL",
        "description_small": "Mysterious things start happening when 12-year-old Naota meets a strange woman on a Vespa wielding a big guitar.",
        "genere": "Animation, Action, Comedy",
        "description_big": "It’s probably the most unique, unorthodox anime I’ve ever watched. The first time I watched FLCL I thought “what the hell am I watching” and that’s something that will run through the minds of most first time viewers. It’s a series that is near impossible to describe, hilarious randomness probably best sums it up. For those who do watch it through it inevitably becomes one of their favourite series, my only complaint is I wish there had been more episodes."
    },
    {
        "title": "Future Boy Conan",
        "description_small": "Long after a devastating war almost destroyed the entire world, a boy with superhuman strength fights to save his friends from those who seek to conquer what is left of civilization.",
        "genere": "Animation, Adventure, Comedy",
        "description_big": "Future Boy Conan= A masterfully directed 26 episode anime by the great Hayao Miyazaki. It features all the whimsy and wonder that's present in his films, in my opinion this series surpasses most of his other work. The art is also of a very high standard in comparison to other works from this era. It's a great, wholesome adventure. It appeals to the kid in all of us, everybody can enjoy this one."
    },
    {
        "title": "Gankutsuou: The Count of Monte Cristo",
        "description_small": "Trying to escape his uneventful life, Albert, the son of a renowned general from Paris, makes a journey with his friend Franz. During his travels, he meets an immensely wealthy nobleman ...                See full summary »",
        "genere": "Animation, Drama, Mystery",
        "description_big": "Gankutsuou= This is definitely a brilliant anime, partly due to the fact that it's loosely based on the novel (The Count of Monte Cristo). The word loosely is key, do not expect if you have read the book that this anime stays true to the source material. Anybody who goes into this expecting an anime version of the novel will be bitterly disappointed. It should be noted that this anime has an outlandish, visually stunning art style. The art style may put some off but for those who have seen a lot of anime with generic animation, the attempt to be different will be much appreciated. The suspense, betrayal and thriller aspects of this anime are outstanding. It will make you want to read the novel, which even the purists will agree is a good thing."
    },
    {
        "title": "Welcome to the N.H.K.",
        "description_small": "This surreal dramedy follows Satou Tatsuhiro as he attempts to escape the evil machinations of the NHK.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Welcome To The NHK= A story about a recluse. How could an anime about a withdrawn loner who barricades himself in his apartment be so interesting? While the first half of the series makes great use of humour, the second half is extremely touching and poignant. It deals with a wide variety of mature problems in society from parental violence to suicide. Don't underestimate this anime by the comedic moments early on, it's one of the most profound and memorable anime I've ever seen."
    },
    {
        "title": "Nobody's Boy: Remi",
        "description_small": "A compelling story in which orphaned Remi gets hired out to a traveling street entertainer Vitalis when her foster parents fall on hard times.",
        "genere": "Animation, Adventure, Drama",
        "description_big": "Ie Naki Ko= Remi is a young boy that's sold to a traveling entertainer, he now begins his life as a slave. You know immediately as you sit down to watch this it's going to be full of hardship and sadness. This anime is brilliantly directed by the great Osamu Dezaki, he allows the classic novel this is based on to be fully realised as an anime adaptation. It's a terrific sombre journey, recommend to fans of The Rose of Versailles and Romeo no Aoi Sora."
    },
    {
        "title": "The Slayers",
        "description_small": "The adventures of a teenage sorceress and her companions as they quest for gold and glory (especially gold).",
        "genere": "Animation, Action, Adventure",
        "description_big": "Slayers= A perfect harmony of fantasy, action and comedy. Slayers is hugely enjoyable. It features loads of memorable characters, I suspect Lina will be most peoples favourite. Despite the fact this anime is from the 90's it has aged really well. One of the most fun and zany anime I've seen. What's great about this is that the second season Slayers Next doesn't disappoint, I actually think it's far better. Highly recommended to comedy/fantasy fans."
    },
    {
        "title": "Planetes",
        "description_small": "Ai Tanabe joins the Debris Section of the Technora Corporation as they work to remove the debris left around Earth. As Ai tries to accommodate to space life, she learns more about her crew on the dilapidated 'Toy Box'.",
        "genere": "Animation, Drama, Sci-Fi",
        "description_big": "Do you need an anime with heart pounding action in every episode? If so Planetes is not for you. Do you like anime that aren't much more than sentimental drivel, where the show takes cheap emotional shots by having characters in anguish constantly, those anime that underestimate the intellect of the viewer and try to induce cheap tears. If so Planetes is not for you. If however you like anime with deep and reflective messages on life, if you like anime completely out of the norm, if you like well fleshed out characters, a solid story and some flawless voice acting... then this is the anime for you.P.S. (The only thing holding this back from being a perfect 10/10 is the slight issues with animation and the underwhelming music).Nonetheless certainly for experienced and adult anime viewers this is an essential watch."
    },
    {
        "title": "Kimi ni Todoke: From Me to You",
        "description_small": "Sawako Kuronuma is misunderstood due to her resemblance to the ghost girl from The Ring. But one day the nicest boy in the class, Kazehaya befriends her and everything changed after that and also everyone perspective of Sawako but there's going to be struggle await for her up in the future.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "It's slightly different than your regular romance story but in the end it remains a generic shy girl and hot guy fall in love tale. This anime uses the \"misunderstandings\" effect a lot, particularly in the second season (a method Maison Ikkoku had been using over 25 years earlier), that's not to say Kimi ni Todoke doesn't do it well I'm just pointing out it has been done. Highly recommended to fans of Maison Ikkoku and vice versa. It's a must for fans of slow paced, misunderstandings romance anime."
    },
    {
        "title": "City Hunter",
        "description_small": "The adventures of Ryo Saeba, a gun-for-hire living in the Tokyo metropolis, who will take on any dangerous job as long as it involves beautiful women.",
        "genere": "Animation, Action, Comedy",
        "description_big": "A incredible cast of characters, great art for its era, a strong soundtrack but most importantly delivers brilliant comedy and roaring action, that's City Hunter in a nut shell. This is an absolute masterpiece of anime and its hidden gem status makes it a special anime to all of those who have watched it, it's one of those series you almost want to keep to yourself."
    },
    {
        "title": "Ouran High School Host Club",
        "description_small": "You'll fall for the Ouran Host Club: Tamaki's truly romantic. Kaoru and Hikaru display brotherly love, Kyoya's brainy, Honey's innocent, and Mori's manly. Oh, and don't forget Haruhi. He knows what girls want, because he's a girl too.",
        "genere": "Animation, Comedy, Romance",
        "description_big": "A favourite of female anime viewers, Ouran High School Host Club is a silly rom/com full to the brim with pretty boys and pink frills. It's mostly an episodic comedy so there's not much in the way of a deep plot, however many people are sure to enjoy the characters and humour. Recommended to fans of Fruits Basket and Toradora!"
    },
    {
        "title": "Les Miserables: Shoujo Cosette",
        "description_small": "The classic novel by Victor Hugo returns to the world of Japanese anime in Nippon Animation's 52-episode adaptation \"Les Misérables: Shoujo Cosette\". The plot shifts its focus to include ...                See full summary »",
        "genere": "Animation, Family, History",
        "description_big": "Les Miserables: Shoujo Cosette= Imagine some Japanese guys got their hands on the story of Les Miserables, then imagine they decided to take that story which definitely is not for children and they decided to adapt it to make it kid friendly. That's exactly what this is, surprisingly though it's quiet good. The story is kept as close to the source as possible considering the age of the intended audience. The most fascinating thing about this adaptation is that the story revolves more around Cosette than Jean Valjean. Recommended highly to fans of Les Miserables who aren't complete purists and are open to adaptations."
    },
    {
        "title": "Michiko and Hatchin",
        "description_small": "Michiko is a free-willed \"sexy diva\" who escaped from prison, while Hatchin is a run away girl fleeing from her strict catholic foster family. The two join forces and set off on an unpredictable road trip seeking their own freedom.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This anime is surprisingly good, it's definitely one of my guilty pleasure anime. Let me say this right off the bat, Michiko is one of the hottest, most kickass anime chicks ever. The story is set in Brazil and tells the tale of a sexy criminal named Michiko who escapes from prison and rescues an abused girl called Hatchin. This may not be the most thought provoking plot but it was a really solid series. It may have dragged a little in the middle but this series gives off almost a Cowboy Bebop vibe that its real strengths are the characters. It has fantastic production values, some entertaining action scenes and a good ending. Highly recommended to fans of Cowboy Bebop, Black Lagoon and Phantom: Requiem For The Phantom."
    },
    {
        "title": "Bakemonogatari",
        "description_small": "Third-year high school student Koyomi Araragi is human again. Cured of his vampirism, he seeks to help other supernaturals with their problems. Koyomi becomes involved in their lives, revealing secrets in people he once knew.",
        "genere": "Animation, Action, Comedy",
        "description_big": "This is a mystery/romance/supernatural anime that involves vampires. It is genuinely a masterpiece of its genre, the only reason it's not higher is that it appeals mostly to a niche group.It's a very unique anime with some very peculiar characters, while it may take some time to adjust, you will inevitably become hooked. This anime is guaranteed to entertain if given a fair shake."
    },
    {
        "title": "Mononoke",
        "description_small": "A mysterious man called the Medicine Seller travels along feudal Japan, uncovering and slaying evil spirits called \"Mononoke\".",
        "genere": "Animation, Fantasy, Horror",
        "description_big": "Mononoke= The greatest outright horror anime of all time, it's undeniable. This puts all the pretenders among the anime horror genre firmly in their mediocre place. It's fantastically stylish and capable of instilling genuine fear into the viewer. Yes it features a hugely unique art style that casual anime viewers may not like but this isn't a drawback, this series is for those who can appreciate it, at only 12 episodes long you've got no excuses. It really is a spectacular work of art."
    },
    {
        "title": "Princess Tutu",
        "description_small": "A duck turned girl with magical powers must help save a prince from an unfinished fairy tale.",
        "genere": "Animation, Adventure, Comedy",
        "description_big": "On paper I should have hated Princess Tutu, the name, the cuteness, the fact that it's a magical girl anime and the huge amount of everything pink. I mean this is as far as it gets from Cowboy Bebop and yet somehow I enjoyed Princess Tutu. It has a tremendous plot with huge drama and unexpected plot twists. This anime shattered all preconceptions I had going into it, don't be put off by the silly comedy in the initial episodes. It's magnificently unique, has a wonderful plot and is easily the greatest magical girl anime ever made. Even guys can thoroughly enjoy this."
    },
    {
        "title": "Rainbow: The Seven from Compound Two, Cell Six",
        "description_small": "Set in 1955, the anime follows the story of seven teenagers locked in a reformatory, waiting for a ray of light in a daily hell of suffering and humiliation, focusing especially on how they faced the life once regained freedom.",
        "genere": "Animation, Crime, Drama",
        "description_big": "A group of deliquents tossed into a grim disciplinary school in post WW2 Japan, well this anime certainly has a different setting. That will be welcomed by people sick of the typical school set or future set anime. Rainbow has good visuals, sound and an interesting premise, so why isn't this higher? Well for an anime that should be all about the characters, there's a surprising lack of character development. This anime is bleak, depressing, action heavy and at times uplifting. It should have been a character driven masterpiece but in the end Rainbow in effort to appeal to the widest demographic wound up just being a good series. Recommended to fans of friendship stories."
    },
    {
        "title": "The Mysterious Cities of Gold",
        "description_small": "A trio of kids must search throughout 16th Century South America for personal answers linked to the legendary El Dorado.",
        "genere": "Animation, Adventure, Comedy",
        "description_big": "This is unquestionably one of the greatest adventure anime ever made, each episode is utterly fantastic, it really has stood the test of time. Anybody who enjoys adventure stories should really check this one out, I'd compare it to Studio Ghibli films in the respect that it can be wholly enjoyed by both children and adults. I'd recommend watching this in Japanese but it's impossible to find subtitled, you'll have little alternative but to watch the English dubs for this one."
    },
    {
        "title": "Goodbye, Mr. Despair",
        "description_small": "A pessimistic high school teacher must somehow manage a class of eccentric students.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "If you like dark humour you're in for a treat. It's an unorthodox comedy about a teacher often referred to as Mr. Despair, he's called that because he's often left suicidal by the harsh and gruesome reality of life. He teaches a class full of strange and unique students. This anime has great production values and I'd really recommend it if you want a different type of comedy full of quirky characters."
    },
    {
        "title": "Anne of Green Gables",
        "description_small": "Based on the books by Lucy Maud Montgomery, this 50 episode series tells the story of Anne Shirley, a young orphan living in 19th century Canada.",
        "genere": "Animation, Drama, Family",
        "description_big": "Akage no Anne= It's a wonderful anime, it's just a simple tale of a young orphan girl growing up and dealing with everyday issues. There isn't some great villain that needs to be stopped, no maniacal schoolgirls wielding knives or vampires behind every closed door, no Akage no Anne is a tale of utmost simplicity and all the better for that fact. It's a joy and wholesome story of a girl making friends, dealing with school and studies etc.It's a masterfully told story, it's among the finest slow paced, slice of life anime. If the slice of life genre isn't your thing maybe give this a miss. Recommended to fans of Nobody's Boy: Remi and Romeo no Aoi Sora."
    },
    {
        "title": "Space Pirate Captain Harlock",
        "description_small": "In 2977, mankind has space colonies, machines do all the work and everyone just wants to have fun. When deadly plant-based aliens that look like women attack the Earth in order to colonize it, only one rogue captain can stop them.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Space Pirate Captain Harlock= Classic anime at its finest. The main draw for me here is the characters, Harlock is a once off, he's magnificent and treated with a fascinating seriousness. Harlock is a character that many have imitated and reinvented in modern anime, if you wish to see the original, your search is over. This anime had a big influence on the medium, many since have taken cues from Harlock. The closest thing in anime today to this is One Piece, it evokes a similar feeling. Recommended highly to fans of old school anime."
    },
    {
        "title": "Chobits",
        "description_small": "Hideki finds the discarded and malfunctioning Persocom Chi, a personal computer that looks like a girl. While trying to fix and care for Chi, Hideki discovers that she might be a Chobits, a robot of urban legend that has free will.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "It's one of those anime with humanoid computers where the boundaries of what's ethical becomes blurred. It has comedy, romance and fanservice. Personally I think the anime could have been better if the themes were explored more seriously and a little less focus was on the perverted comedy. It's still a good anime but it could have been great, hence it's placing."
    },
    {
        "title": "Treasure Island",
        "description_small": "Jim Hawkins, a thirteen-year-old boy in the eighteenth century, runs the Admiral Benbow Inn with his mother since his father died. The plots starts when a drunken sailor decides to stay in the hotel.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Takarajima= If you're a fan of Treasure Island you're in for a treat. This anime adaptation to the classic novel captures all the adventure and whimsy of the source material. Who could overlook an anime teaming with pirates that include the notorious Long John Silver. The animation is a little dated but everything else about this from the plot, characters and music are top notch."
    },
    {
        "title": "Urusei yatsura",
        "description_small": "An unlucky, womanizing high schooler becomes the unwilling target of a vivacious alien girl's affections after winning an interplanetary game of tag against her.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Urusei Yatsura= Rumiko Takahashi strikes again! This was her first work to receive an anime adaptation and considering Rumiko was still testing things out that she would nail on subsequent works, it has to be said Urusei Yatsura is pretty darn good. It's a silly comedy about a lecherous idiot and an attractive biniki wearing alien. Urusei Yatsura is one of the most influential anime ever made, it's an episodic comedy but it's a enjoyable watch and it has that great 80's feel."
    },
    {
        "title": "Wolf's Rain",
        "description_small": "In a post-apocalyptic future where humans live in domed cities surrounded by wasteland, wolves are assumed to be two hundred years extinct.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Wolf's Rain = Another one of those anime that divides the viewers into two camps, you either love or hate it, in effort for objectivity I'm taking a stance of indifference. Certainly it has a great soundtrack and a very unique story.There was far too many recaps considering how short the series is and the ending left a little to be desired in my opinion. A definite work of art and worth watching at least once."
    },
    {
        "title": "Fist of the North Star",
        "description_small": "After a nuclear war turns Earth into a lawless wasteland, Kenshiro, a practitioner of the deadly master art \"Hokuto Shinken\", fights a succession of tyrannical warriors to restore order.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Fist Of The North Star= Everything Dragonball wishes it was, FOTNS summed up is an epic, exceptionally violent battle shounen. It features characters heads exploding and people being torn apart. Also unlike DB and DBZ when characters die, they stay dead! Which is a big plus. It's unrefined, action entertainment at its peak. Few long running anime have the balls to kill off big characters. Recommended to those who have the audacity to say DBZ should be on this list, seriously watch Fist Of The North Star, Kenshiro would beat Goku with ease :P"
    },
    {
        "title": "Samurai Champloo",
        "description_small": "Fuu, a waitress who works in a teahouse, rescues two master swordsmen, Mugen and Jin, from their execution to help her find the \"samurai who smells of sunflowers.\"",
        "genere": "Animation, Action, Adventure",
        "description_big": "Samaurai Champloo is an epic action anime with lots of sword action. The characters in this are amazing. Mugen and Jin are beyond badass and Fuu is exceptionally cute. It’s beautifully animated and well written. It’s by the same director who made Cowboy Bebop. Enough said, it’s incredible."
    },
    {
        "title": "Ef: A Tale of Memories.",
        "description_small": "A story of love, heartbreak and youth, as the stories of 6 different characters, which seem initially unrelated, begin to intertwine.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Over the course of its 12 episodes this romance series manages to keep our interest as separate stories intertwine while it manages to avoid most cliches of the genre. Personally it's a mixed bag for me, while I enjoyed one storyline, the other bored me. I enjoyed some characters and others felt like deadweight. However this unconventional romance anime manages to make it on this list through its unique approach and solid visuals."
    },
    {
        "title": "Trigun",
        "description_small": "Vash the Stampede is the most infamous outlaw on the planet Gunsmoke and with a 60 billion double dollar price on his head the most sought after.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Some people love Trigun, I would have too if the show hadn't done a complete 180 midway through. It started off as a light comedy/action anime, where Vash was the focus and comedic relief. Then around half way through the show they switched the tone, tried to make it serious and in my opinion it didn't work. I've always felt the ending to be bitterly disappointing however this is just my opinion. Watch this for Vash, for the comedy, for that western/six shooter feel."
    },
    {
        "title": "Hellsing Ultimate",
        "description_small": "The vampire Alucard, his master Sir Integra Fairbrook Wingates Hellsing, and his newly sired ward Seras Victoria, try to protect England from a war-crazed SS-Major who seeks to start an eternal war with his vampire army.",
        "genere": "Animation, Action, Fantasy",
        "description_big": "Remember Hellsing? Remember enjoying it? Remember thinking Alucard was a great character? Do you like action, violence and vampires?If yes then you must watch this. I know people who watched the original anime and have not seen this may be a little apprehensive but guys seriously this is better, much better."
    },
    {
        "title": "Toradora!",
        "description_small": "Toradora tells the tale of Ryuji (dragon) and Taiga (tiger) helping each other confess to their crushes.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "It's one of the famous school set comedies in recent years, Toradora! just about deserves its place on this list. I can't exactly pinpoint why but I couldn't become emotionally attached to any of the characters, I found it as an anime to be wholly cliched and stereotypical, it's for these reasons that I found it only to be an okay anime.I'm sure many people will adore Toradora! and I can appreciate that, don't let my opinion colour how you view this work. It definitely has merit, I just feel it could have been better."
    },
    {
        "title": "Kaleido Star",
        "description_small": "Sora, a young girl from Japan, comes to America in search of her dream. She wants, with all her heart, to be a member of the famous Kaleido Stage, a combination of musicals, acrobatics and ...                See full summary »",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Girly anime at its best xD. Okay between all the graphic violence and science fiction it's okay to indulge yourself in something a little less intense. Kaleido Star tells its story in a formulaic and slow paced method but this isn't a drawback as the sweet tale about a girl trying to realise her dream compliments the measured approach. It has some very sincere characters, uplifting moments, gorgeous visuals and it exudes a warm feeling."
    },
    {
        "title": "Blood+",
        "description_small": "In present day Okinawa, a young amnesiac girl named Saya combats vicious, shape-shifting vampires. Her adoptive family and friends help her track down their source and uncover her past.",
        "genere": "Animation, Action, Adventure",
        "description_big": "This is an anime for fans of the supernatural genre. It's one of those anime that has a teenage girl fighting the powers of darkness. Personally I've never understood why it has to be a schoolgirl facing demons/monsters, I guess people like to see girls in uniform acting all badass. This isn't one of my preferred genre but it has quality animation. If you're a fan of vampires or schoolgirls facing life/death situations check this out."
    },
    {
        "title": "Golden Boy",
        "description_small": "A University drop-out rides Japan on his bicycle, taking part-time jobs and trying not to take women.",
        "genere": "Animation, Comedy",
        "description_big": "It's a 6 episode OVA series. This anime is all about perverted comedy. I'm not really sure how to elaborate further, there's not a whole lot to be said, it's a guys comedy about a college drop out who has a high sex drive and overactive imagination. I struggled on whether or not to include this, I mean there's not much in the way of a plot or even a solid cast of characters. However the objective of a comedy is to make the viewer laugh, in this respect Golden Boy was successful for me, I did laugh and that's why it's included on the list.Recommended to fans of GTO: Great Teacher Onizuka."
    },
    {
        "title": "JoJo's Bizarre Adventure",
        "description_small": "The story of the Joestar family, who are possessed with intense psychic strength, and the adventures each member encounters throughout their lives.",
        "genere": "Animation, Action, Adventure",
        "description_big": "Over the top action and cheese that actually works. Seriously it's an anime where pure outrageous actions and words reign supreme, it's like the producers bottled \"Anchorman: The Legend of Ron Burgundy\" and then turned it into this anime.It's an action, adventure, supernatural series that isn't easy to describe, especially when the plot is almost an irrelevance. I recommend this to people who like action that can never be too big and words that can never be too loud."
    },
    {
        "title": "The Melancholy of Haruhi Suzumiya",
        "description_small": "The crazy adventures of the SOS Brigade, led by the insane but charismatic Haruhi.",
        "genere": "Animation, Comedy, Fantasy",
        "description_big": "Slice of life anime as you've never experienced it, this anime enjoyed a great deal of success and acclaim upon its initial release, personally I've never been quiet as fond of it as others have been.I'm basing the inclusion of this anime on the original 14 episode series, before the staff decided to cash in and dilute the quality by making an abundance more of Haruhi, you can have too much of a good thing.I've said enough, anybody with a mild interest in anime knows all about this series, I'm sure you've heard of it, it's a school set, comedy/mystery/slice of life anime."
    },
    {
        "title": "XXXHOLiC",
        "description_small": "Kimihiro Watanuki, a high-schooler, is troubled by monsters and spirits, but meets Yuko Ichihara, a beautiful witch, who grants his wish to not be able to see them. However, there is a price.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "I almost didn't include this anime because the themes it explores are far better done in two similar anime above, Mushi-shi and Natsume Yuujinchou. However I've come to realise xxxHOLic is a good series in its own right. It's once again a story about a guy that can see spirits etc that are invisible to most people, while it never manages to pull off the profound messages or stunning visuals of the previously mentioned series, xxxHOLiC does achieve a large degree of success in tackling those aspects. Something xxxHOLiC did was bring more humour to the table than the other anime, that was most welcomed.Recommended to fans of Mushi-shi and Natsume Yuujinchou, just don't expect the same exceptional level on visuals."
    },
    {
        "title": "Nodame kantâbire",
        "description_small": "Shinichi Chiaki, is a talented musician who finds a rather strange companion in Megumi Noda. As they get to know each other they also meet a variety of crazy characters and face some challenging opportunities.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "Nodame Cantabile= Classical music, romance and comedy what more could you want. If I'm honest the story and tone are light, no question the biggest draw of this anime is the music. If you're a fan of classical music you'll adore this anime, there was pieces from Beethoven, Mozart, Rachmaninov, Liszt and lots of other famous composers. The comedy works most of the time and the romance feels sincere, this anime has a lot going for it, it's nothing groundbreaking but certainly a solid series worth watching once. Highly recommended to fans of classical music. ”"
    },
    {
        "title": "Crest of the Stars",
        "description_small": "Jinto is a polite young man whose world was overrun by the biggest empire in the galaxy canned the Abh Empire. He meets the lovely Lafiel who he befriends.",
        "genere": "Animation, Action, Drama",
        "description_big": "Crest of the Stars is a decent sci-fi anime, unlike other anime far less focus is put on action and more on drama/politics/romance. There's action here but I must stress there is no mecha, so if you're not a fan of giant fighting robots then rejoice, this is a space set anime with no giant robots in sight. This anime is rather slow paced so be sure to watch the subsequent seasons (titled Banner of the Stars) if you want to fully appreciate this work."
    },
    {
        "title": "Clannad",
        "description_small": "A high school student who cares little about school or others meets a lonely girl who had to repeat a year while all her friends finished high school. He decides to hang out with her and soon meets more friendly students.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "I can't deny how successful Clannad has become even if I feel all the praise it gets is largely unjustified. I say this because season 1 of Clannad is nothing more than a very average, very generic school life/drama. It's season 2 where it picks up, Clannad: After Story. I personally don't believe it was anything spectacular and the first season is undeniably mediocre. However Clannad over the course of its two seasons had an abundance of drama, sadness and joy. It was something of an emotional roller coaster and for that reason it's included on this list."
    },
    {
        "title": "Katanagatari",
        "description_small": "Kyotoryuu, is the legendary fencing school. However, instead of a sword, it uses one's hands and legs as weapons. Shichika and his sister Nanami are the sole remaining descendants of the ...                See full summary »",
        "genere": "Animation, Action, Adventure",
        "description_big": "I applaud this anime for its originality and innovation. The art style is visually appealing, the script writing thoroughly engaging. Fantastic voice acting, a tried and tested narrative involving a samurai style.It's by the same author who wrote Bakemonogatari and while completely different, in my opinion is even more recommendable. The biggest fault of this series is that it perhaps is slightly too dialogue heavy. Indeed we hear about epic battles in this series but never actually see them. P.S. This anime is 12 episodes long and each episode lasts for roughly 50 minutes."
    },
    {
        "title": "Kimagure Orange Road",
        "description_small": "Kyousuke Kasuga is a completely normal Japanese high school student, with two very big problems. The first is his complete and utter inability to choose between two girls, the bright, ...                See full summary »",
        "genere": "Animation, Comedy, Drama",
        "description_big": "It's 48 episodes of true brilliance, I'm usually not a big fan of romantic comedies but as with everything nothing is absolute and there is always rare exceptions. KOR is one of these rare exceptions. It has silly characters, hilarious situations, love triangles, misunderstandings and a great 80's feeling which makes it hugely comparable to Maison Ikkoku. Recommended to those who are daunted with tackling the 96 episodes of Maison Ikkoku, Kimagure Orange Road is similar but not quite as good. If you enjoy this anime you really should watch the aforementioned masterpiece."
    },
    {
        "title": "The Future Diary",
        "description_small": "A young man competes with people around the world for a chance to become the succesor of God, with a diary that is able to tell the future.",
        "genere": "Animation, Action, Drama",
        "description_big": "Better known as Mirai Nikki, this anime is flawed but for many of us falls under the title of guilty pleasure. Built under the guise of a menacing femme fatale, many are sure to fall for Yuno due to her warped sense of love.It's got action, romance, comedy, ridiculous characters, some sketchy plot twists and some shaky time travel.Recommended to fans of Death Note and Elfen Lied."
    },
    {
        "title": "Koi Kaze",
        "description_small": "Koshiro and Nanoka fall deeply in love, then discover they are the children of their divorced estranged parents... making them brother and sister. How will their relationship turn out?",
        "genere": "Animation, Drama, Romance",
        "description_big": "This anime deals with the taboo subject of incest. Don't let the appalling theme put you off, this isn't low brow entertainment, this anime tackles with frightening realism and maturity a subject that most only speak about in hushed voices. This anime will force you to look at your morals and make you question what is love. This anime pulls no punches and I'm putting my neck on the line with its inclusion on this list. Recommended to those old enough to understand its message."
    },
    {
        "title": "Texhnolyze",
        "description_small": "In a man-made underground society, descendants of a banished generation vie for control of the crumbling city of Lux. Ichise, an orphan turned prize fighter, loses a leg and an arm to satisfy an enraged fight promoter.",
        "genere": "Animation, Drama, Sci-Fi",
        "description_big": "After much deliberation I decided to include this title, I struggled with this because while Texhnolyze is certainly an interesting piece of work it's far from entertaining. The story tells the tale of a boxer who lives in an underground society, he becomes the guinea pig of a mad doctor who replaces some of his limbs with artificial appendages called Texhnolyze. This is one of the most bleak and depressing anime I've ever seen, it's also so unique that it appeals very much to a minority. To give you an example some 17 minutes pass in the first episode before a single word is spoken. To complete Texholyze you will require the patience of a saint, the stomach of a goat and the mind of a brilliant lunatic. It's a mind bending anime that I managed to appreciate. Highly recommended to fans of Serial Experiments Lain."
    },
    {
        "title": "The Tatami Galaxy",
        "description_small": "When a nameless student at Kyoto University encounters a demigod one night, he asks to relive the past three years in order to win the heart of Ms. Akashi, the object of his affection.",
        "genere": "Animation, Comedy, Drama",
        "description_big": "This anime is so utterly unique I almost didn't include it, it's executed in such a meticulous, unorthodox way that it almost entirely alienates the audience. You will most definitely have to step out of your comfort zone to try and handle this mind bending piece of work.This anime often repeats the events of previous episodes (reminds me of how the film Groundhog Day was done), the thing is to be patient. If you've seen Groundhog Day you'll understand what I mean. You should also be warned that the subs come at you at the speed of light, some very fast talkers in this anime. Recommended to those who can handle the strange approach and fast subs, I'd only recommend this to highly experienced anime viewers (at least 200 anime seen to completion under your belt)."
    }
]

const df = []

//main object for saving files
const csvFile = new CsvFile({
    path: path.resolve(__dirname, csv_path),
    headers: true,
});

const create_embedding = async (string_list) => {
    if (!process.env.API_KEY) {
        return [];
    }
    const opeanai_headers = {
        "Authorization": `Bearer ${api_key}`,
        "Content-Type": "application/json"
    };
    const openai_body_embed = {
        "input": string_list,
        "model": "text-embedding-3-small",
        "encoding_format": "float"
    };
    const options = { method: 'POST', headers: opeanai_headers, body: JSON.stringify(openai_body_embed) }
    const embeddings = await fetch("https://api.openai.com/v1/embeddings", options)
        .then(response => response.json())
        .then(data => {
            return data;
        })
        .catch(error => {
            console.error('Error making POST request:', error);
            return []
        });
    return embeddings.data.map(item => item.embedding)
}

async function save_records_db(data) {
    await client.query('CREATE TABLE IF NOT EXISTS animes (id bigserial PRIMARY KEY, title text, description_small text, genere text, description_big text, embedding vector(1536))');
    for (let row of data) {
        await client.query('INSERT INTO animes (title, description_small, genere, description_big, embedding) VALUES ($1, $2, $3, $4, $5)', [row.title, row.description_small, row.genere, row.description_big, pgvector.toSql(row.embedding)]);
    }
}

async function load_main_data() {
    if (process.env.MODE == "pg") {
        await client.connect();
        await pgvector.registerType(client);
    }
    if (fs.existsSync(path.resolve(__dirname, csv_path))) {
        if (df.length === 0) {
            const data = await csvFile.read({ headers: true }, row => ({ ...row, embedding: row.embedding.split(',').map(Number) }));
            df.push(...data);
        }
        return;
    }

    //this codes executes if no animes csv file exist
    const data_with_embeddings = [];
    const batchSize = 300;
    for (let i = 0; i < souce_data.length; i += batchSize) {
        const batch = souce_data.slice(i, i + batchSize);
        //let embeddingResults = await create_embedding(batch.map(item => item.description_big + '\n Generes:' + item.genere));
        let modified_elements = batch.map((item, index) => ({ ...item, embedding: embeddingResults[index] }));
        data_with_embeddings.push(...modified_elements);
    }
    df.push(...data_with_embeddings);

    if (process.env.PG_SUPPORT) {
        await save_records_db(df);
    }

    csvFile
        .create(data_with_embeddings)
        .then(() => {
            console.log('Data saved on csv');
        })
        .catch((e) => console.error('There was a problem writing file', e))
}
load_main_data();


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function relatedness_fn(A, B) {
    var dotproduct = 0;
    var mA = 0;
    var mB = 0;

    for (var i = 0; i < A.length; i++) {
        dotproduct += A[i] * B[i];
        mA += A[i] * A[i];
        mB += B[i] * B[i];
    }

    mA = Math.sqrt(mA);
    mB = Math.sqrt(mB);
    var similarity = dotproduct / (mA * mB);

    return similarity;
}
function compareFn(a, b) {
    //we compare similarity values
    if (a[1] < b[1]) {
        return 1;
    } else if (a[1] > b[1]) {
        return -1;
    }
    // a must be equal to b
    return 0;
}

app.get('/api/v1/search', async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm) return res.json([]);
    console.log(process.env.MODE)
    const result = [];
    if (process.env.MODE == "simple") {
        for (let item of df) {
            if (item.title === searchTerm) {
                result.push({ Titulo: item.title, Descripcion: item.description_small, Genero: item.genere });
            }
        }
        return res.status(200).json(result);
    }

    let query_response = await create_embedding([searchTerm])

    //creating db connection and querying
    if (process.env.MODE == "pg") {
        if (!process.env.PG_SUPPORT || process.env.PG_SUPPORT.toLowerCase() == "false") {
            return [];
        }
        const result = await client.query('SELECT title, description_small, genere FROM animes ORDER BY embedding <-> $1 LIMIT 5', [pgvector.toSql(query_response[0])]);
        const result_array = result.rows.map(item => ({ Titulo: item.title, Descripcion: item.description_small, Genero: item.genere }));
        return res.status(200).json(result_array);
    }

    if (process.env.MODE == "vectra") {
        const results = await index.queryItems(query_response[0], 3);
        let result_array = results.map(result => ({ Titulo: result.item.metadata.title, Descripcion: result.item.metadata.description_small, Genero: result.item.metadata.genere }));
        return res.status(200).json(result_array);
    }

    let strings_and_relatednesses = [];
    for (let item of df) {
        strings_and_relatednesses.push([{ Titulo: item.title, Descripcion: item.description_small, Genero: item.genere }, relatedness_fn(query_response[0], item.embedding)])
    }
    strings_and_relatednesses.sort(compareFn);
    result.push(...strings_and_relatednesses.slice(0, 5).map(item => item[0]));
    return res.status(200).json(result);
});

app.post('/api/v1/load_data', async (req, res) => {
    try {
        const { title, short, long, genere } = req.body;
        let result_data = await create_embedding([long + '\n Generes:' + genere]);
        if (result_data.length === 0) {
            return res.status(500).json({ result: "There was an error" + JSON.stringify(e) });
        }
        const record_to_save = {
            "title": title,
            "description_small": short,
            "genere": genere,
            "description_big": long,
            embedding: result_data[0]
        };
        let result = await csvFile.append([record_to_save]).then(() => ({ result: "success" }))
        await save_records_db([record_to_save]);

        return res.status(200).json(result);
    } catch (e) {
        return res.status(500).json({ result: "There was an error" + JSON.stringify(e) });
    }
});

// Start the server
const PORT = 4322;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
