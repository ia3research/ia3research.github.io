const LEFT_LABEL = 'Transcription with a conventional model';
const RIGHT_LABEL = 'Transcription with <strong><u>our</u></strong> improved model';

function stripTags(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

const audioBlocks = [
    {
        title: 'Pueblos pintorescos enclavados en ondulantes colinas',
        audio: '/demos/simplia/audio/recording1.wav',
        type: 'audio/wav',
        phrases: {
            left: 'Pueden pintar eso con ser grabados en ornolantes o con intrusos',
            right: 'Pueblos pintorescos enclavados en ondulantes colinas'
        }
    },
    {
        title: 'Chefs locos experimentan con cocinas de fusión',
        audio: '/demos/simplia/audio/recording2.wav',
        type: 'audio/wav',
        phrases: {
            left: 'Chef loco de perimeda gongozina de busión',
            right: 'Chefs locos experimentan con cocinas de fusión'
        }
    },
    {
        title: 'Sueños quijotescos de exuberancia juvenil',
        audio: '/demos/simplia/audio/recording3.wav',
        type: 'audio/wav',
        phrases: {
            left: 'Sueños de un hijo de su coster, su gran tía juvenil',
            right: 'Sueños quijotescos de soberbia juvenil'
        }
    },
    {
        title: 'Melodías de xilófono se mezclan con notas de oboe',
        audio: '/demos/simplia/audio/recording4.wav',
        type: 'audio/wav',
        phrases: {
            left: 'Melodía del chelso y el',
            right: 'Melodías de xilófono se mezclan con notas de oboe'
        }
    }
];
let currentIndex = 0;
let cleanupCurrentBlock = null;

const sliderViewport = document.getElementById('sliderViewport');
const sliderContent = document.getElementById('sliderContent');
const sliderPrevButton = document.getElementById('sliderPrev');
const sliderNextButton = document.getElementById('sliderNext');
const SLIDE_DISTANCE = 60;
const CONTENT_TRANSITION_SPEC = 'transform 0.35s cubic-bezier(.4,1.3,.5,1), opacity 0.25s ease';
const HEIGHT_TRANSITION_SPEC = 'height 0.35s ease';
const ANIMATION_DURATION = 350;
const HEIGHT_RESET_DELAY = 450;

function renderAudioBlock(idx, animate = false, direction = 'right') {
    const block = audioBlocks[idx];
    const trackTitle = block.title ?? `Track ${idx + 1}`;
    const sourceType = block.type ?? 'audio/mpeg';
    const html = `
    <div class="player-wrap w-full flex flex-col items-center gap-12">
        <h2 class="track-title text-2xl font-semibold text-blue-500 text-center leading-tight">${trackTitle}</h2>
        <audio id="audioPlayer" controls preload="none" class="w-full max-w-3xl">
            <source src="${block.audio}" type="${sourceType}">
            Your browser does not support the audio element.
        </audio>
        <div class="demo-columns flex flex-col md:flex-row gap-10 items-stretch w-full">
            <div class="demo-column flex-1">
                <button id="leftBtn" class="btn w-full px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">${LEFT_LABEL}</button>
                <div class="mt-6 border border-gray-200 bg-gray-50 text-gray-700 p-4 rounded-md min-h-[3rem] w-full break-words text-left leading-relaxed" id="leftMsg" aria-live="polite"></div>
                <span id="leftMsgMeasure" class="msg msg-measure" style="position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;width:100%"></span>
            </div>
            <div class="demo-column flex-1">
                <button id="rightBtn" class="btn w-full px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">${RIGHT_LABEL}</button>
                <div class="mt-6 border border-gray-200 bg-gray-50 text-gray-700 p-4 rounded-md min-h-[3rem] w-full break-words text-left leading-relaxed" id="rightMsg" aria-live="polite"></div>
                <span id="rightMsgMeasure" class="msg msg-measure" style="position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;width:100%"></span>
            </div>
        </div>
    </div>
    `;

    const slideOffset = direction === 'right' ? -SLIDE_DISTANCE : SLIDE_DISTANCE;

    if (cleanupCurrentBlock) {
        cleanupCurrentBlock();
        cleanupCurrentBlock = null;
    }

    const mountContent = () => {
        sliderContent.innerHTML = html;
        cleanupCurrentBlock = attachBlockEvents();
    };

    if (animate) {
        const previousHeight = sliderViewport.offsetHeight || sliderContent.offsetHeight;
        sliderViewport.style.height = `${previousHeight}px`;
        sliderViewport.style.transition = HEIGHT_TRANSITION_SPEC;
        sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
        sliderContent.style.opacity = '1';
        sliderContent.style.transform = 'translateX(0)';

        requestAnimationFrame(() => {
            sliderContent.style.opacity = '0';
            sliderContent.style.transform = `translateX(${slideOffset}px)`;
        });

        setTimeout(() => {
            mountContent();
            const nextHeight = sliderContent.offsetHeight;
            sliderViewport.style.transition = 'none';
            sliderViewport.style.height = `${previousHeight}px`;
            sliderContent.style.transition = 'none';
            sliderContent.style.opacity = '0';
            sliderContent.style.transform = `translateX(${-slideOffset}px)`;
            sliderViewport.getBoundingClientRect();

            requestAnimationFrame(() => {
                sliderViewport.style.transition = HEIGHT_TRANSITION_SPEC;
                sliderViewport.style.height = `${nextHeight}px`;
                sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
                sliderContent.style.opacity = '1';
                sliderContent.style.transform = 'translateX(0)';
            });

            setTimeout(() => {
                sliderViewport.style.height = '';
                sliderViewport.style.transition = '';
                sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
            }, HEIGHT_RESET_DELAY);
        }, ANIMATION_DURATION);
    } else {
        mountContent();
        sliderViewport.style.height = '';
        sliderViewport.style.transition = '';
        sliderContent.style.opacity = '1';
        sliderContent.style.transform = 'translateX(0)';
        sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
    }

    function attachBlockEvents() {
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const leftMsg = document.getElementById('leftMsg');
        const rightMsg = document.getElementById('rightMsg');
        const leftMsgMeasure = document.getElementById('leftMsgMeasure');
        const rightMsgMeasure = document.getElementById('rightMsgMeasure');
        const demoColumns = document.querySelector('.demo-columns');

        if (leftBtn) {
            leftBtn.innerHTML = LEFT_LABEL;
            leftBtn.setAttribute('aria-label', stripTags(LEFT_LABEL));
        }
        if (rightBtn) {
            rightBtn.innerHTML = RIGHT_LABEL;
            rightBtn.setAttribute('aria-label', stripTags(RIGHT_LABEL));
        }

        // Robust measurement: create an off-DOM clone sized to the reference element
        // and measure its height. This avoids layout shifts and problems with hidden
        // elements or transforms.
        function measureHeight(text, referenceEl) {
            // Determine width to measure at
            const refRect = referenceEl.getBoundingClientRect();
            const width = Math.max(0, Math.floor(refRect.width));

            const meas = document.createElement('div');
            // Apply basic box model and typography similar to the target element
            meas.style.position = 'absolute';
            meas.style.visibility = 'hidden';
            meas.style.left = '-9999px';
            meas.style.top = '0';
            meas.style.width = `${width}px`;
            meas.style.boxSizing = 'border-box';
            // Copy font-related styles from reference to improve accuracy
            const refStyle = window.getComputedStyle(referenceEl);
            meas.style.font = refStyle.font || `${refStyle.fontSize} ${refStyle.fontFamily}`;
            meas.style.padding = refStyle.padding;
            meas.style.border = refStyle.border;
            meas.style.whiteSpace = 'pre-wrap';
            meas.style.wordWrap = 'break-word';

            // If text contains HTML tags, use innerHTML; otherwise use textContent
            if (text && /<[^>]+>/.test(text)) {
                meas.innerHTML = text;
            } else {
                meas.textContent = text;
            }

            document.body.appendChild(meas);
            const h = meas.offsetHeight;
            document.body.removeChild(meas);
            return h;
        }

        function applyEqualHeights() {
            const leftHeight = measureHeight(block.phrases.left, leftMsg);
            const rightHeight = measureHeight(block.phrases.right, rightMsg);
            const maxHeight = Math.max(leftHeight, rightHeight);
            // Set explicit heights so layout doesn't change when text is revealed
            leftMsg.style.height = `${maxHeight}px`;
            rightMsg.style.height = `${maxHeight}px`;
            // Ensure min-height remains enforced as fallback
            leftMsg.style.minHeight = leftMsg.style.minHeight || '';
            rightMsg.style.minHeight = rightMsg.style.minHeight || '';
        }

        function applyEqualButtonHeights() {
            if (!leftBtn || !rightBtn) return;
            leftBtn.style.height = '';
            rightBtn.style.height = '';
            const leftRect = leftBtn.getBoundingClientRect();
            const rightRect = rightBtn.getBoundingClientRect();
            const maxHeight = Math.max(leftRect.height, rightRect.height);
            leftBtn.style.height = `${maxHeight}px`;
            rightBtn.style.height = `${maxHeight}px`;
        }

        function revealText(targetEl, text, intervalMs = 45, measureEl) {
            targetEl.textContent = '';
            let position = 0;
            const intervalId = setInterval(() => {
                targetEl.textContent += text.charAt(position);
                position += 1;
                if (position >= text.length) {
                    clearInterval(intervalId);
                }
            }, intervalMs);
        }

        function handleClick(btn, targetEl, phrase, measureEl) {
            if (btn.disabled) return;
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            revealText(targetEl, phrase, 45, measureEl);
        }

        const scheduleEqualAdjustments = () => {
            requestAnimationFrame(() => {
                applyEqualHeights();
                applyEqualButtonHeights();
            });
        };

        // Reserve enough space so the typing effect does not shift the layout.
        applyEqualHeights();
        applyEqualButtonHeights();
        scheduleEqualAdjustments();

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleEqualAdjustments).catch(() => {});
        }

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => {
                  applyEqualButtonHeights();
                  applyEqualHeights();
              })
            : null;

        if (resizeObserver && demoColumns) {
            resizeObserver.observe(demoColumns);
        }

        const onResize = () => {
            scheduleEqualAdjustments();
        };

        window.addEventListener('resize', onResize);

        leftBtn.addEventListener('click', () => handleClick(leftBtn, leftMsg, block.phrases.left, leftMsgMeasure));
        rightBtn.addEventListener('click', () => handleClick(rightBtn, rightMsg, block.phrases.right, rightMsgMeasure));

        [leftBtn, rightBtn].forEach((button) => {
            button.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    button.click();
                }
            });
        });

        return () => {
            window.removeEventListener('resize', onResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }
}

function updateSliderButtons() {
    if (sliderPrevButton) {
        sliderPrevButton.disabled = currentIndex === 0;
        // show pointer when active, not-allowed when disabled
        sliderPrevButton.style.cursor = sliderPrevButton.disabled ? 'not-allowed' : 'pointer';
        sliderPrevButton.style.pointerEvents = sliderPrevButton.disabled ? 'none' : 'auto';
    }
    if (sliderNextButton) {
        sliderNextButton.disabled = currentIndex === audioBlocks.length - 1;
        // show pointer when active, not-allowed when disabled
        sliderNextButton.style.cursor = sliderNextButton.disabled ? 'not-allowed' : 'pointer';
        sliderNextButton.style.pointerEvents = sliderNextButton.disabled ? 'none' : 'auto';
    }
}


sliderPrevButton.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex -= 1;
        renderAudioBlock(currentIndex, true, 'left');
        updateSliderButtons();
    }
});

sliderNextButton.addEventListener('click', () => {
    if (currentIndex < audioBlocks.length - 1) {
        currentIndex += 1;
        renderAudioBlock(currentIndex, true, 'right');
        updateSliderButtons();
    }
});

// Inicializar
renderAudioBlock(currentIndex);
updateSliderButtons();
