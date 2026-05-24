// Copyright Epic Games, Inc. All Rights Reserved.

#include "PlayerAircraft.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "InputAction.h"
#include "Kismet/GameplayStatics.h"
#include "MIlitaryGameMode.h"

APlayerAircraft::APlayerAircraft()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.016f; // 60 FPS

	AutoPossessPlayer = EAutoReceiveInput::Player0;
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	AircraftMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("AircraftMesh"));
	RootComponent = AircraftMesh;
	AircraftMesh->SetSimulatePhysics(false);
	AircraftMesh->SetCollisionEnabled(ECC_QueryAndPhysics);

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 400.0f;
	CameraBoom->bUsePawnControlRotation = true;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
}

void APlayerAircraft::BeginPlay()
{
	Super::BeginPlay();

	if (APlayerController* PlayerController = Cast<APlayerController>(Controller))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			PlayerController->GetLocalPlayer()->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}

	CurrentHealth = MaxHealth;
	CurrentAmmo = MaxAmmo;
	CurrentMissiles = MaxMissiles;
	CurrentFlares = MaxFlares;
	CurrentSpeed = 2000.0f;
}

void APlayerAircraft::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	UpdateFlightPhysics(DeltaTime);
	UpdateWeaponTimers(DeltaTime);
	ClampAltitude();
}

void APlayerAircraft::SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (UEnhancedInputComponent* EnhancedInputComponent = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		if (MoveAction)
		{
			EnhancedInputComponent->BindAction(MoveAction, ETriggerEvent::Triggered, this, &APlayerAircraft::Move);
		}

		if (LookAction)
		{
			EnhancedInputComponent->BindAction(LookAction, ETriggerEvent::Triggered, this, &APlayerAircraft::Look);
		}

		if (FireAction)
		{
			EnhancedInputComponent->BindAction(FireAction, ETriggerEvent::Started, this, &APlayerAircraft::OnFirePressed);
			EnhancedInputComponent->BindAction(FireAction, ETriggerEvent::Completed, this, &APlayerAircraft::OnFireReleased);
		}

		if (MissileAction)
		{
			EnhancedInputComponent->BindAction(MissileAction, ETriggerEvent::Triggered, this, &APlayerAircraft::OnMissilePressed);
		}

		if (FlareAction)
		{
			EnhancedInputComponent->BindAction(FlareAction, ETriggerEvent::Triggered, this, &APlayerAircraft::OnFlarePressed);
		}
	}
}

void APlayerAircraft::Look(const FInputActionValue& Value)
{
	const FVector2D LookAxisVector = Value.Get<FVector2D>();

	if (Controller != nullptr)
	{
		AddControllerPitchInput(LookAxisVector.Y * TurnRate);
		AddControllerYawInput(LookAxisVector.X * TurnRate);
	}
}

void APlayerAircraft::Move(const FInputActionValue& Value)
{
	const FVector2D MovementVector = Value.Get<FVector2D>();

	if (Controller != nullptr)
	{
		if (MovementVector.X != 0.0f)
		{
			CurrentRoll = FMath::Clamp(CurrentRoll + MovementVector.X * RollRate, -90.0f, 90.0f);
		}

		if (MovementVector.Y != 0.0f)
		{
			CurrentPitch = FMath::Clamp(CurrentPitch + MovementVector.Y * TurnRate, -90.0f, 90.0f);
		}
	}
}

void APlayerAircraft::OnFirePressed()
{
	bIsGunFiring = true;
}

void APlayerAircraft::OnFireReleased()
{
	bIsGunFiring = false;
}

void APlayerAircraft::OnMissilePressed()
{
	FireMissile();
}

void APlayerAircraft::OnFlarePressed()
{
	DeployFlare();
}

void APlayerAircraft::UpdateFlightPhysics(float DeltaTime)
{
	CurrentSpeed = FMath::Clamp(CurrentSpeed, MinSpeed, MaxSpeed);

	FVector ForwardDirection = GetActorForwardVector();
	Velocity = ForwardDirection * CurrentSpeed;

	ApplyGravityAndThrust(DeltaTime);

	FVector NewLocation = GetActorLocation() + Velocity * DeltaTime;
	SetActorLocation(NewLocation);

	FRotator NewRotation = GetActorRotation();
	NewRotation.Pitch = CurrentPitch;
	NewRotation.Roll = CurrentRoll;

	CurrentRoll = FMath::FInterpTo(CurrentRoll, 0.0f, DeltaTime, 2.0f);
	CurrentPitch = FMath::FInterpTo(CurrentPitch, 0.0f, DeltaTime, 2.0f);

	SetActorRotation(NewRotation);
}

void APlayerAircraft::ApplyGravityAndThrust(float DeltaTime)
{
	const float GravityStrength = 980.0f;
	Velocity.Z -= GravityStrength * DeltaTime;

	Velocity *= 0.98f;

	if (CurrentSpeed < MaxSpeed)
	{
		CurrentSpeed += Acceleration * DeltaTime;
	}
}

void APlayerAircraft::ClampAltitude()
{
	FVector CurrentLocation = GetActorLocation();

	if (CurrentLocation.Z > -100.0f)
	{
		CurrentLocation.Z = -100.0f;
		SetActorLocation(CurrentLocation);

		if (AMIlitaryGameMode* GameMode = Cast<AMIlitaryGameMode>(GetWorld()->GetAuthGameMode()))
		{
			GameMode->EndMission(TEXT("TERRAIN COLLISION - MISSION FAILED"));
		}
	}

	const float MaxAltitude = 10000.0f;
	if (CurrentLocation.Z < -MaxAltitude)
	{
		CurrentLocation.Z = -MaxAltitude;
		SetActorLocation(CurrentLocation);
	}
}

void APlayerAircraft::UpdateWeaponTimers(float DeltaTime)
{
	if (GunFireTimer > 0.0f)
	{
		GunFireTimer -= DeltaTime;
	}
	else if (bIsGunFiring && CurrentAmmo > 0)
	{
		FireGun();
		GunFireTimer = GunCooldown;
	}

	if (MissileFireTimer > 0.0f)
	{
		MissileFireTimer -= DeltaTime;
	}

	if (FlareDeployTimer > 0.0f)
	{
		FlareDeployTimer -= DeltaTime;
	}
}

void APlayerAircraft::FireGun()
{
	if (CurrentAmmo <= 0)
	{
		return;
	}

	CurrentAmmo -= 2;
	SpawnMuzzleFlash();
}

void APlayerAircraft::FireMissile()
{
	if (MissileFireTimer > 0.0f || CurrentMissiles <= 0 || !CurrentTarget)
	{
		return;
	}

	CurrentMissiles--;
	MissileFireTimer = MissileCooldown;
}

void APlayerAircraft::DeployFlare()
{
	if (FlareDeployTimer > 0.0f || CurrentFlares <= 0)
	{
		return;
	}

	CurrentFlares--;
	FlareDeployTimer = FlareCooldown;
}

void APlayerAircraft::TakeDamage(float DamageAmount)
{
	CurrentHealth = FMath::Max(0.0f, CurrentHealth - DamageAmount);

	if (CurrentHealth <= 0.0f)
	{
		if (AMIlitaryGameMode* GameMode = Cast<AMIlitaryGameMode>(GetWorld()->GetAuthGameMode()))
		{
			GameMode->EndMission(TEXT("AIRFRAME LOST - KIA"));
		}
	}
}

void APlayerAircraft::SetTargetAircraft(AAirTarget* Target)
{
	CurrentTarget = Target;
}

void APlayerAircraft::SpawnMuzzleFlash()
{
	// TODO: Implement particle effect
}

void APlayerAircraft::SpawnExplosionEffect(const FVector& Location)
{
	// TODO: Implement explosion effect
}
