# Brochure Creator
## Description
This project is a brochure creator that allows you to create and customize brochures for specific locations in the style of those
found in Super Mario Odyssey. The brochures are designed to be visually appealing and informative, providing details about the
location, images, and other relevant information, as well as providing a map of the location.

This project uses Google Gemini's spatial understanding capabilities to analyze the location through Google Maps and generate a 
brochure that includes relevant images and information. It fetches images from the internet and determines the best images to
showcase the location. Additionally, visual elements such as colors, icons, and general theme are chosen to match the style of
Super Mario Odyssey, while also ensuring that things like color palettes fit the theme of the location.

Additionally, in case a brochure is not generated to your liking, you can select specific elements and tell the AI what to 
change about them. You can also upload your own images and customize text to your liking.

Some example locations provided in the demos folder include:
- New York City, USA
- London, England
- Paris, France
- Tokyo, Japan

## Functionality
Brochure generation is done in multiple steps:
1. The user selects a location and the AI uses the Google Maps API Tools to gather information about the location. The AI 
   will read a variety of sources, such as Wikipedia, travel blogs, and other relevant websites, to gather information
   about the location.
2. Each website is rated based on its relevance and reliability, and the AI will use this information to select the top 
   _n_ (configurable) sources to use for the brochure. It will then scrape these websites and convert
   the scraped data to JSON format.
3. The AI will then analyze the data and extract relevant information, such as the location's history, culture, and 
   attractions. It will also extract images and compare them with the text content, to determine which images are most
   relevant to the location (e.g. if the text mentions a specific landmark, the AI will look for images of that landmark).
4. The AI will then merge all of this data into a new JSON object, this time in `./working/merge/sitename.json`, which will be used to generate the brochure. The JSON object
   will include the location's name, description, images, and other relevant information, while also ensuring that we aren't 
   repeating information. Important objects like landmarks, history, and culture will have their own sections dedicated to them.
5. The AI will attempt to create a general layout for the brochure, including the color palette, fonts, and other visual 
   elements. It will also ensure that the layout is visually appealing and easy to read, while also making sure we aren't
   stuffing too much or too little information into each section. It also has a collection of brochures from Super Mario Odyssey,
   which it will use as a reference for the layout. The AI will create a few different layouts, and then let the
   user choose which one they prefer.
6. Once the layout is generated, the user is able to adjust or change specific elements of the brochure. The user can select
   specific elements and tell the AI what to change about them. The user can also upload their own images and customize text
   to their liking.
7. Finally, the AI will generate the final brochure in a PDF format, which can be downloaded and printed.