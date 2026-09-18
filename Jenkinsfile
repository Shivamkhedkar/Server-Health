pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'registry.hub.docker.com'
        IMAGE_BACKEND = 'devopsmonitor/backend'
        IMAGE_FRONTEND = 'devopsmonitor/frontend'
        BUILD_TAG = "${BUILD_NUMBER}-${GIT_COMMIT[0..7]}"
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            parallel {
                stage('Backend Dependencies') {
                    steps {
                        dir('backend') {
                            sh 'python3 -m pip install -r requirements.txt flake8 black'
                        }
                    }
                }
                stage('Frontend Dependencies') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --no-audit'
                        }
                    }
                }
            }
        }

        stage('Lint') {
            parallel {
                stage('Backend Lint') {
                    steps {
                        dir('backend') {
                            // No `|| true`: a real lint failure now fails the
                            // build, same as any other quality gate. If a
                            // specific rule needs to be waived, waive it
                            // explicitly in a checked-in .flake8 config with
                            // a comment explaining why - not by swallowing
                            // the exit code here.
                            sh 'flake8 app --max-line-length=120'
                        }
                    }
                }
                stage('Frontend Lint') {
                    steps {
                        dir('frontend') {
                            // `npm run lint` used to reference a script that
                            // did not exist in package.json at all - masked
                            // by `|| true` so it silently "passed" every
                            // time without ever actually linting anything.
                            // package.json now defines a real `lint` script
                            // (ESLint) and this stage no longer swallows its
                            // exit code.
                            sh 'npm run lint'
                        }
                    }
                }
            }
        }

        stage('Unit Tests') {
            steps {
                dir('backend') {
                    // Pure logic/service-layer tests - no HTTP client, no
                    // route wiring. See backend/pytest.ini for the marker
                    // definitions and backend/tests/ for which tests carry
                    // which marker.
                    sh 'pytest tests/ -m unit --cov=app --cov-report=xml -v'
                }
            }
        }

        stage('Integration/API Tests') {
            steps {
                dir('backend') {
                    // Everything else: FastAPI TestClient hitting real
                    // routes end-to-end (auth, RBAC, websocket, alerts,
                    // rate limiting), plus the frontend's own component
                    // tests.
                    sh 'pytest tests/ -m "not unit" --cov=app --cov-append --cov-report=xml -v'
                }
                dir('frontend') {
                    sh 'npm test'
                }
            }
        }

        stage('Security Scan') {
            steps {
                echo 'Running Trivy container vulnerability scan...'
                // --exit-code 1 actually fails the build on HIGH/CRITICAL
                // findings instead of only ever printing a report (the
                // previous invocation had no --exit-code at all, so Trivy
                // always exited 0 regardless of what it found).
                // --ignore-unfixed excludes CVEs with no available fix yet
                // (usually upstream OS packages) - failing a build over a
                // vulnerability nobody can patch yet isn't actionable; if
                // your policy wants those to fail too, drop this flag.
                sh 'trivy fs --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed .'
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building Docker images with tag ${BUILD_TAG}..."
                sh "docker compose -f docker-compose.prod.yml build"
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying containers via Docker Compose...'
                sh 'docker compose -f docker-compose.prod.yml up -d'
            }
        }

        stage('Health Check') {
            steps {
                echo 'Verifying stack health through the public entrypoint...'
                sh 'sleep 10'
                // Backend's own port is not published to the host in
                // docker-compose.prod.yml - both checks go through the one
                // publicly exposed port (frontend/Nginx), which proxies
                // /health to the backend (see frontend/nginx.conf).
                sh 'curl -f http://localhost:80/health || exit 1'
                sh 'curl -f http://localhost:80/ || exit 1'
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution completed.'
            cleanWs()
        }
        success {
            echo 'Deployment SUCCESSFUL!'
        }
        failure {
            echo 'Deployment FAILED! Check logs.'
        }
    }
}
