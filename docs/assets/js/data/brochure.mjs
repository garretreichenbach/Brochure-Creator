import*as t from"https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js";import*as e from"https://unpkg.com/prop-types@15.6/prop-types.min.js";export default({locationData:t,layout:e,onElementSelect:n})=>{const[o,r]=useState(null),[a,c]=useState(null);useEffect((()=>{t&&r(t)}),[t]),useEffect((()=>{const t=document.documentElement;Object.entries(e.styling.colorScheme).forEach((([e,n])=>{t.style.setProperty(`--${e}-color`,n)})),t.style.setProperty("--heading-font",e.styling.typography.headings),t.style.setProperty("--body-font",e.styling.typography.body)}),[e]);return o?'<div className="brochure">\n\t\t\t<header className="brochure-header">\n\t\t\t\t<h1>{content.name}</h1>\n\t\t\t\t<div className="location-info">\n\t\t\t\t\t{content.formatted_address}\n\t\t\t\t</div>\n\t\t\t</header>\n\n\t\t\t<section className="introduction" onClick={() => handleElementClick({ type: \'introduction\' })}>\n\t\t\t\t<h2>Welcome to {content.name}!</h2>\n\t\t\t\t<p>{content.introduction}</p>\n\t\t\t</section>\n\n\t\t\t{renderAttractions()}\n\n\t\t\t<section className="culture" onClick={() => handleElementClick({ type: \'culture\' })}>\n\t\t\t\t<h2>Cultural Highlights</h2>\n\t\t\t\t<p>{content.culture}</p>\n\t\t\t</section>\n\n\t\t\t{renderActivities()}\n\t\t\t{renderFacts()}\n\n\t\t\t<footer className="brochure-footer">\n\t\t\t\t{renderMap()}\n\t\t\t\t<div className="footer-info">\n\t\t\t\t\t<p>Last updated: {new Date(content.metadata.generated).toLocaleDateString()}</p>\n\t\t\t\t\t<p>Data sources: {content.metadata.sources.join(\', \')}</p>\n\t\t\t\t</div>\n\t\t\t</footer>\n\t\t</div>\n\t':"<div>Loading brochure content...</div>"};