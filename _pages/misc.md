---
title: "Word Avalanches"
permalink: /misc/
layout: splash
author_profile: false
breadcrumbs: false
classes: wide
---

<style>
.page__content {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
  padding: 2em 1em;
}

.page__content p {
  font-size: 1.2em;
  line-height: 1.6;
}

.avalanche-container {
  margin-top: 2em;
}

.avalanche-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 1em;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.avalanche-item:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.avalanche-question {
  padding: 1.5em;
  font-size: 0.95em;
  font-weight: 500;
  color: #333;
}

.avalanche-answer {
  background: #fff;
  padding: 0;
  border-top: 1px solid #e9ecef;
  max-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.avalanche-answer.show {
  max-height: 200px;
  padding: 1.5em;
}

.avalanche-answer p {
  margin: 0;
  font-size: 0.9em;
  color: #666;
  line-height: 1.5;
}
</style>

<a href="https://www.reddit.com/r/WordAvalanches/wiki/index/" style="font-size: 0.8em; font-weight: normal; text-decoration: none;">what is this?</a>

<div class="avalanche-container">
  {% for avalanche in site.data.avalanches %}
    <div class="avalanche-item" onclick="toggleAnswer(this)">
      <div class="avalanche-question">{{ avalanche.scenario }}</div>
      <div class="avalanche-answer">
        <p>{{ avalanche.key }}</p>
      </div>
    </div>
  {% endfor %}
</div>

<script>
function toggleAnswer(element) {
  const answer = element.querySelector('.avalanche-answer');
  answer.classList.toggle('show');
}
</script>