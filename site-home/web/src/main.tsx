import "./site.css";
import "./landing.css";
import { wireChrome } from "./chrome";
import { mount } from "./layer";
import { LAND, LAND_SRC } from "./stations";

wireChrome();
mount(LAND_SRC, LAND);
