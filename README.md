# Retina

Retina is a free open source web application to share network visualizations online, without any server required. It is developed by [OuestWare](https://www.ouestware.com/en/) for [Tommaso Venturini](http://www.tommasoventurini.it/) from [CNRS Center Internet et Société](https://cis.cnrs.fr/). It is released under the [GNU GPLv3 license](https://gitlab.com/ouestware/retina/-/blob/main/LICENSE).

<p align="center">
  <img src="https://ouestware.gitlab.io/retina/beta/logo_CNRS_CIS.jpg" width="260" />
  <img src="https://ouestware.gitlab.io/retina/beta/logo_ouestware_text.svg" width="260" />
</p>

You can see a running example [here](https://ouestware.gitlab.io/retina/beta/#/graph/?url=https%3A%2F%2Fouestware.gitlab.io%2Fretina%2Fbeta%2Fdataset.gexf&c=c&s=s&sa[]=s&sa[]=r&ca[]=t&ca[]=c&st[]=t&st[]=c&ds=1&dc=1), or try it with your own graphs at [ouestware.gitlab.io/retina](https://ouestware.gitlab.io/retina/).

## Features

Retina aims at helping people sharing interactive network maps online:

1. Graph _editors_ give Retina a graph file, and tell it how their graph file should be interpreted
2. They share a link to their visualization with graph _explorers_
3. Graph _explorers_ can then see the graph and interact with it

### Filtering

Users can filter nodes on their attributes. Retina tries to detect whether attributes represent quantitative, qualitative or textual information. Graph _editors_ can select which fields can be used to filter or not for graph _explorers_.

### Colors and sizes caption

In most graph file formats, nodes and edges can have colors and sizes of their own, but we cannot know how they have been determined. This makes it impossible to display a caption for the graph.

Retina allows mapping node colors on node attributes (in a way inspired by [Gephi](https://gephi.org/features/)), so that it can display a **proper caption**.

### Sharing

Graphs in Retina can be shared as classic links or special links to be embedded in iframes. An export can also disable all actions that modify the state (colors and size fields, filters) to the user, to share more of an "enhanced zoomable image" of the graph.

## How to use it

1. Open [Retina](https://ouestware.gitlab.io/retina/)
2. Get some graph file (such as a [GEXF](https://gexf.net/) graph file from [Gephi](https://gephi.org/) for instance)
3. Put it somewhere on the internet, so that you can have a public URL leading to it
4. Go to [ouestware.gitlab.io/retina](https://ouestware.gitlab.io/retina)
5. Click on `Online`
6. Enter your GEXF file URL, and click on `Visualize`

You can now fine tune some settings for viewers, and when you are ready click on the `Share` button on the top of the left panel.

You can now share the URL of the page to people, and they'll see the same network as you do.

## How to contribute

Retina was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) using [TypeScript](https://www.typescriptlang.org/).

It uses [SASS](https://sass-lang.com/) for styles, and is based on [Bootstrap](https://getbootstrap.com/) for its base styles and its grid system, and [react-icons](https://react-icons.github.io/react-icons/) for icons.

Finally, the graphs are rendered using [sigma.js](https://www.sigmajs.org/) and [graphology](https://graphology.github.io/).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
