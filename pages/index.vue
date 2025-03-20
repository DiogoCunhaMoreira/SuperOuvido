<template>
  <div class="container">
    <h1>Piano Chord Detector</h1>
    <p>Play a chord on your piano and see the detected notes below:</p>

    <ClientOnly>
      <PianoDetector />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
// Component imports are automatic in Nuxt 3
</script>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
}

p {
  text-align: center;
  margin-bottom: 30px;
}
</style>
