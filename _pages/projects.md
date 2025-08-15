---
title: "Projects"
permalink: /projects/
layout: single
author_profile: true
classes: wide
---

<style>
.section-container {
  margin-bottom: 3em;
}

.section-header {
  width: 100%;
  margin-bottom: 1.5em;
  clear: both;
}

.project-container {
  width: 100%;
  margin-bottom: 2em;
  clear: both;
}

.project-title {
  margin-bottom: 0.5em;
}

.project-description {
  margin-bottom: 1em;
}
</style>

<div class="section-container">
  <h2 class="section-header" id="research-projects">Research</h2>
  
  {% assign research_projects = site.data.projects | where: "category", "research" %}
  {% for project in research_projects %}
    <div class="project-container">
      <h3 class="project-title">
        {% if project.url %}
          <a href="{{ project.url }}">{{ project.title }}</a>
        {% else %}
          {{ project.title }}
        {% endif %}
      </h3>
      <div class="project-description">
        {{ project.description }}
      </div>
    </div>
  {% endfor %}
</div> 

<div class="section-container">
  <h2 class="section-header" id="engineering-projects">Engineering</h2>
  
  {% assign engineering_projects = site.data.projects | where: "category", "engineering" %}
  {% for project in engineering_projects %}
    <div class="project-container">
      <h3 class="project-title">
        {% if project.url %}
          <a href="{{ project.url }}">{{ project.title }}</a>
        {% else %}
          {{ project.title }}
        {% endif %}
      </h3>
      <div class="project-description">
        {{ project.description }}
      </div>
    </div>
  {% endfor %}
</div>