pipeline {
    agent {
        node {
            label 'built-in'
            customWorkspace '/deploy/smart-drain'
        }
    }

    options {
        disableConcurrentBuilds()
        timestamps()
        skipDefaultCheckout()
    }

    parameters {
        booleanParam(
            name: 'SEED_MOCK_DATA',
            defaultValue: false,
            description: '최초 배포에서만 실행합니다. 기존 drain_code 데이터는 수정하지 않고 건너뜁니다.'
        )
    }

    environment {
        DEPLOY_DIR = '/deploy/smart-drain'
        DEPLOY_BRANCH = 'dev'
        COMPOSE_PROJECT_NAME = 'smartdrain-dev'
    }

    stages {
        stage('Checkout pipeline scripts') {
            steps {
                checkout scm
            }
        }

        stage('Prepare environment') {
            steps {
                withCredentials([file(
                    credentialsId: 'smartdrain-dev-env-file',
                    variable: 'ENV_FILE'
                )]) {
                    sh '''
                        cp "$ENV_FILE" "$DEPLOY_DIR/.env"
                        chmod 600 "$DEPLOY_DIR/.env"
                    '''
                }
            }
        }

        stage('Preflight') {
            steps {
                sh '.jenkins/scripts/preflight.sh'
            }
        }

        stage('Validate') {
            steps {
                sh '.jenkins/scripts/validate.sh'
            }
        }

        stage('Deploy') {
            steps {
                sh '.jenkins/scripts/deploy.sh'
            }
        }

        stage('Optional initial seed') {
            when {
                expression { return params.SEED_MOCK_DATA }
            }
            steps {
                sh '.jenkins/scripts/seed.sh'
            }
        }

        stage('Smoke test') {
            steps {
                sh '.jenkins/scripts/smoke-test.sh'
            }
        }
    }

    post {
        failure {
            sh '.jenkins/scripts/collect-logs.sh || true'
        }
    }
}
